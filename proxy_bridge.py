"""
OmniShield Proxy Bridge — Local HTTP CONNECT Proxy
====================================================
Chrome connects here as a plain HTTP proxy (127.0.0.1:LOCAL_PORT).
This bridge relays traffic through the remote SOCKS5/HTTP proxy,
handling username/password authentication transparently.

This is the same approach used by GoLogin, Multilogin, and AdsPower.
"""

import os
import sys
import socket
import struct
import select
import base64
import threading
import time


class ProxyBridge:
    """
    Local HTTP CONNECT proxy that authenticates with a remote
    SOCKS5 or HTTP proxy on behalf of Chrome.
    """

    def __init__(self, remote_type, remote_ip, remote_port, username="", password=""):
        self.remote_type = str(remote_type).upper()  # "SOCKS5", "HTTP", "HTTPS"
        self.remote_ip = str(remote_ip).strip()
        self.remote_port = int(remote_port)
        self.username = str(username).strip()
        self.password = str(password).strip()
        self.server_socket = None
        self.local_port = 0
        self.running = False

    def start(self):
        # Auto-detect the actual proxy protocol before starting
        self._auto_detect_protocol()

        self.server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.server_socket.bind(('127.0.0.1', 0))
        self.local_port = self.server_socket.getsockname()[1]
        self.server_socket.listen(64)
        self.running = True

        t = threading.Thread(target=self._accept_loop, daemon=True)
        t.start()
        time.sleep(0.05)  # Let the listener bind
        print(f"[ProxyBridge] Listening 127.0.0.1:{self.local_port} -> {self.remote_type} {self.remote_ip}:{self.remote_port}")
        return self.local_port

    def _auto_detect_protocol(self):
        """Probe the remote proxy to determine if it is SOCKS5 or HTTP."""
        try:
            s = socket.create_connection((self.remote_ip, self.remote_port), timeout=5)
            # Send a SOCKS5 greeting
            s.sendall(b"\x05\x02\x00\x02")
            s.settimeout(3)
            resp = s.recv(2)
            s.close()
            if resp and resp[0] == 0x05:
                # Server answered with SOCKS5 version byte — it's a SOCKS5 proxy
                if self.remote_type != "SOCKS5":
                    print(f"[ProxyBridge] Auto-detected SOCKS5 (was configured as {self.remote_type})")
                self.remote_type = "SOCKS5"
            else:
                # Server responded with something else (likely HTTP) — treat as HTTP
                if "SOCKS" in self.remote_type:
                    print(f"[ProxyBridge] Auto-detected HTTP proxy (was configured as {self.remote_type})")
                self.remote_type = "HTTP"
        except Exception as e:
            print(f"[ProxyBridge] Protocol detection failed ({e}), using configured: {self.remote_type}")

    def stop(self):
        self.running = False
        try:
            self.server_socket.close()
        except Exception:
            pass

    # ── Accept Loop ──────────────────────────────────────────────

    def _accept_loop(self):
        while self.running:
            try:
                client, addr = self.server_socket.accept()
                t = threading.Thread(target=self._handle_client, args=(client,), daemon=True)
                t.start()
            except Exception:
                break

    # ── Client Handler ───────────────────────────────────────────

    def _handle_client(self, client):
        """
        Chrome sends an HTTP request to us.  Two cases:
          • CONNECT host:port  →  HTTPS tunnel
          • GET http://...     →  Plain HTTP request forwarding
        """
        try:
            raw = b""
            while b"\r\n\r\n" not in raw:
                chunk = client.recv(4096)
                if not chunk:
                    client.close()
                    return
                raw += chunk

            first_line = raw.split(b"\r\n")[0].decode("utf-8", errors="replace")
            parts = first_line.split(" ")
            method = parts[0].upper()

            if method == "CONNECT":
                # HTTPS tunnel:  CONNECT host:port HTTP/1.1
                target = parts[1]
                host, port = self._parse_host_port(target, 443)
                remote = self._connect_through_remote(host, port)
                if remote is None:
                    client.sendall(b"HTTP/1.1 502 Bad Gateway\r\n\r\n")
                    client.close()
                    return
                client.sendall(b"HTTP/1.1 200 Connection established\r\n\r\n")
                self._relay(client, remote)
            else:
                # Plain HTTP request  (GET http://host/path HTTP/1.1)
                # Forward through the remote proxy as-is
                remote = self._connect_raw_remote()
                if remote is None:
                    client.sendall(b"HTTP/1.1 502 Bad Gateway\r\n\r\n")
                    client.close()
                    return

                if "SOCKS" in self.remote_type:
                    # For SOCKS: parse host from the URL, connect, then send raw HTTP
                    url = parts[1] if len(parts) > 1 else "/"
                    host, port, path = self._parse_url(url)
                    remote_connected = self._socks5_connect(remote, host, port)
                    if not remote_connected:
                        client.sendall(b"HTTP/1.1 502 Bad Gateway\r\n\r\n")
                        client.close()
                        remote.close()
                        return
                    # Rewrite the request line to use path-only
                    new_first = f"{method} {path} HTTP/1.1\r\n".encode("utf-8")
                    rest = raw.split(b"\r\n", 1)[1]
                    remote.sendall(new_first + rest)
                else:
                    # For HTTP proxy: forward the full request with auth header
                    if self.username and self.password:
                        raw = self._inject_proxy_auth(raw)
                    remote.sendall(raw)

                self._relay(client, remote)

        except Exception as e:
            print(f"[ProxyBridge] Client handler error: {e}")
            try:
                client.close()
            except Exception:
                pass

    # ── Remote Connection ────────────────────────────────────────

    def _connect_through_remote(self, target_host, target_port):
        """Connect to target_host:target_port through the remote proxy."""
        try:
            if "SOCKS" in self.remote_type:
                return self._connect_via_socks5(target_host, target_port)
            else:
                return self._connect_via_http_proxy(target_host, target_port)
        except Exception as e:
            print(f"[ProxyBridge] Remote connection error: {e}")
            return None

    def _connect_raw_remote(self):
        """Raw TCP connection to the remote proxy (for forwarding)."""
        try:
            s = socket.create_connection((self.remote_ip, self.remote_port), timeout=15)
            if sys.platform == 'win32':
                try:
                    s.setsockopt(socket.IPPROTO_IP, socket.IP_TTL, 64)
                except Exception:
                    pass
            return s
        except Exception as e:
            print(f"[ProxyBridge] Raw connect error: {e}")
            return None

    # ── SOCKS5 ───────────────────────────────────────────────────

    def _connect_via_socks5(self, target_host, target_port):
        """Full SOCKS5 connection with auth + CONNECT to target."""
        s = socket.create_connection((self.remote_ip, self.remote_port), timeout=15)
        if sys.platform == 'win32':
            try:
                s.setsockopt(socket.IPPROTO_IP, socket.IP_TTL, 64)
            except Exception:
                pass
        s.settimeout(15)

        # Step 1: Greeting — offer auth methods
        if self.username and self.password:
            s.sendall(b"\x05\x02\x00\x02")   # NO_AUTH + USER_PASS
        else:
            s.sendall(b"\x05\x01\x00")        # NO_AUTH only

        resp = self._recv_exact(s, 2)
        if resp is None or resp[0] != 0x05:
            s.close()
            raise Exception("SOCKS5 greeting failed: no response")

        chosen_method = resp[1]

        # Step 2: Authenticate if server chose USERNAME/PASSWORD (0x02)
        if chosen_method == 0x02:
            if not (self.username and self.password):
                s.close()
                raise Exception("SOCKS5 server requires auth but no credentials provided")
            user_bytes = self.username.encode("utf-8")
            pass_bytes = self.password.encode("utf-8")
            auth_msg = bytes([0x01, len(user_bytes)]) + user_bytes + bytes([len(pass_bytes)]) + pass_bytes
            s.sendall(auth_msg)
            auth_resp = self._recv_exact(s, 2)
            if auth_resp is None or auth_resp[1] != 0x00:
                s.close()
                raise Exception("SOCKS5 authentication rejected")
        elif chosen_method == 0xFF:
            s.close()
            raise Exception("SOCKS5 server rejected all auth methods")

        # Step 3: CONNECT request
        self._socks5_connect(s, target_host, target_port)

        s.settimeout(None)
        return s

    def _socks5_connect(self, s, host, port):
        """Send SOCKS5 CONNECT command for host:port. Returns True on success."""
        # Build CONNECT request
        try:
            # Try as IPv4
            addr_bytes = socket.inet_aton(host)
            req = b"\x05\x01\x00\x01" + addr_bytes + struct.pack("!H", port)
        except socket.error:
            # Domain name
            host_bytes = host.encode("utf-8")
            req = b"\x05\x01\x00\x03" + bytes([len(host_bytes)]) + host_bytes + struct.pack("!H", port)

        s.sendall(req)

        # Read response: at least 4 bytes header
        resp = self._recv_exact(s, 4)
        if resp is None or resp[0] != 0x05:
            raise Exception("SOCKS5 CONNECT: invalid response")
        if resp[1] != 0x00:
            error_codes = {
                1: "general failure", 2: "connection not allowed",
                3: "network unreachable", 4: "host unreachable",
                5: "connection refused", 6: "TTL expired",
                7: "command not supported", 8: "address type not supported"
            }
            msg = error_codes.get(resp[1], f"unknown error {resp[1]}")
            raise Exception(f"SOCKS5 CONNECT failed: {msg}")

        # Consume the rest of the response (bound address)
        atyp = resp[3]
        if atyp == 0x01:    # IPv4
            self._recv_exact(s, 4 + 2)
        elif atyp == 0x03:  # Domain
            domain_len_bytes = self._recv_exact(s, 1)
            if domain_len_bytes:
                self._recv_exact(s, domain_len_bytes[0] + 2)
        elif atyp == 0x04:  # IPv6
            self._recv_exact(s, 16 + 2)

        return True

    # ── HTTP Proxy ───────────────────────────────────────────────

    def _connect_via_http_proxy(self, target_host, target_port):
        """HTTP CONNECT tunnel through an HTTP proxy with optional auth."""
        s = socket.create_connection((self.remote_ip, self.remote_port), timeout=15)
        if sys.platform == 'win32':
            try:
                s.setsockopt(socket.IPPROTO_IP, socket.IP_TTL, 64)
            except Exception:
                pass
        s.settimeout(15)

        connect_req = f"CONNECT {target_host}:{target_port} HTTP/1.1\r\nHost: {target_host}:{target_port}\r\n"
        if self.username and self.password:
            creds = base64.b64encode(f"{self.username}:{self.password}".encode("utf-8")).decode("utf-8")
            connect_req += f"Proxy-Authorization: Basic {creds}\r\n"
        connect_req += "\r\n"

        s.sendall(connect_req.encode("utf-8"))

        # Read the HTTP response
        response = b""
        while b"\r\n\r\n" not in response:
            chunk = s.recv(4096)
            if not chunk:
                s.close()
                raise Exception("HTTP proxy: connection closed during CONNECT")
            response += chunk

        status_line = response.split(b"\r\n")[0].decode("utf-8", errors="replace")
        if "200" not in status_line:
            s.close()
            raise Exception(f"HTTP proxy CONNECT rejected: {status_line}")

        s.settimeout(None)
        return s

    # ── Helpers ──────────────────────────────────────────────────

    def _recv_exact(self, s, n):
        """Receive exactly n bytes from socket s."""
        buf = b""
        while len(buf) < n:
            chunk = s.recv(n - len(buf))
            if not chunk:
                return None
            buf += chunk
        return buf

    def _relay(self, s1, s2):
        """High-throughput bidirectional data relay with TCP_NODELAY and optimized buffer sizes."""
        sockets = [s1, s2]
        for s in sockets:
            try:
                s.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
                s.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, 262144)
                s.setsockopt(socket.SOL_SOCKET, socket.SO_SNDBUF, 262144)
            except Exception:
                pass

        try:
            while self.running:
                readable, _, errored = select.select(sockets, [], sockets, 5.0)
                if errored:
                    break
                for s in readable:
                    other = s2 if s is s1 else s1
                    data = s.recv(131072)
                    if not data:
                        return
                    other.sendall(data)
        except Exception:
            pass
        finally:
            try:
                s1.close()
            except Exception:
                pass
            try:
                s2.close()
            except Exception:
                pass

    def _inject_proxy_auth(self, raw_request):
        """Inject Proxy-Authorization header into raw HTTP request."""
        creds = base64.b64encode(f"{self.username}:{self.password}".encode("utf-8")).decode("utf-8")
        header = f"Proxy-Authorization: Basic {creds}\r\n".encode("utf-8")
        # Insert before the final \r\n\r\n
        parts = raw_request.split(b"\r\n\r\n", 1)
        return parts[0] + b"\r\n" + header + b"\r\n" + (parts[1] if len(parts) > 1 else b"")

    @staticmethod
    def _parse_host_port(target, default_port=443):
        """Parse 'host:port' string."""
        if ":" in target:
            h, p = target.rsplit(":", 1)
            try:
                return h, int(p)
            except ValueError:
                return target, default_port
        return target, default_port

    @staticmethod
    def _parse_url(url):
        """Parse http://host:port/path into (host, port, path)."""
        if "://" in url:
            url = url.split("://", 1)[1]
        if "/" in url:
            host_part, path = url.split("/", 1)
            path = "/" + path
        else:
            host_part = url
            path = "/"
        if ":" in host_part:
            h, p = host_part.split(":", 1)
            return h, int(p), path
        return host_part, 80, path


def start_local_proxy_tunnel(ptype, ip, port, username="", password=""):
    """Start a local HTTP proxy bridge and return (bridge, local_port)."""
    bridge = ProxyBridge(ptype, ip, int(port), username, password)
    local_port = bridge.start()
    return bridge, local_port
