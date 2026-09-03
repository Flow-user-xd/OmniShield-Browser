import os
import sys
import json
import time
import socket
import subprocess
import signal
import threading
import urllib.request
import logging
from logging.handlers import RotatingFileHandler
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

# Rotating Logger configuration
LOG_FILE = os.path.join(os.path.dirname(__file__), 'omnishield.log')
logger = logging.getLogger("OmniShield")
logger.setLevel(logging.INFO)

if not logger.handlers:
    rfh = RotatingFileHandler(LOG_FILE, maxBytes=5*1024*1024, backupCount=3, encoding='utf-8')
    rfh.setFormatter(logging.Formatter('%(asctime)s [%(levelname)s] %(message)s'))
    sh = logging.StreamHandler(sys.stdout)
    sh.setFormatter(logging.Formatter('%(asctime)s [%(levelname)s] %(message)s'))
    logger.addHandler(rfh)
    logger.addHandler(sh)

# Path configuration
PORT = 3000
PROFILES_FILE = os.path.join(os.path.dirname(__file__), 'profiles.json')
PROXIES_FILE = os.path.join(os.path.dirname(__file__), 'proxies.json')
PROFILES_BASE_DIR = os.path.join(os.path.expanduser('~'), 'OmniShieldProfiles')

PORTABLE_CHROMIUM = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'browser_core', 'chrome.exe')

# Locate Chrome/Brave/Chromium/Edge executable on Windows
CHROME_PATHS = [
    PORTABLE_CHROMIUM,
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
    r"C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe",
    os.path.expandvars(r"%LOCALAPPDATA%\BraveSoftware\Brave-Browser\Application\brave.exe"),
    r"C:\Program Files\Chromium\Application\chrome.exe",
    os.path.expandvars(r"%LOCALAPPDATA%\Chromium\Application\chrome.exe"),
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
]

CHROME_EXEC = None
for path in CHROME_PATHS:
    if os.path.exists(path):
        CHROME_EXEC = path
        break

# In-memory process tracker for launched Chrome profiles
# Key: profileId -> { "pid": int, "port": int, "bridge": ProxyBridge|None, "user_data_dir": str, "name": str }
running_processes = {}

# Ensure base profile storage directory exists
if not os.path.exists(PROFILES_BASE_DIR):
    os.makedirs(PROFILES_BASE_DIR, exist_ok=True)

def is_port_open(port):
    """Check if a local TCP port is currently open and listening."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(0.5)
        result = s.connect_ex(('127.0.0.1', int(port)))
        s.close()
        return result == 0
    except Exception:
        return False

def get_free_cdp_port():
    """Returns an unused CDP port between 9200 and 9500 with socket check."""
    used_ports = {info.get('port') for info in running_processes.values() if isinstance(info, dict) and info.get('port')}
    for port in range(9200, 9500):
        if port in used_ports:
            continue
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.bind(('127.0.0.1', port))
            s.close()
            return port
        except Exception:
            continue
    import random
    return random.randint(9200, 9500)

def validate_launch_inputs(profile_dict):
    """Validates inputs before launching Chrome."""
    res = profile_dict.get('resolution', {})
    width = res.get('width', 1920)
    height = res.get('height', 1080)
    try:
        w = int(width)
        h = int(height)
        if w < 100 or w > 7680 or h < 100 or h > 4320:
            return False, "Resolution dimensions must be between 100x100 and 7680x4320."
    except Exception:
        return False, "Resolution width/height must be integers."

    proxy = profile_dict.get('proxy', {})
    if proxy.get('enabled') and proxy.get('ip'):
        port_val = str(proxy.get('port', '')).strip()
        if not port_val.isdigit() or int(port_val) < 1 or int(port_val) > 65535:
            return False, f"Invalid proxy port '{port_val}'. Must be between 1 and 65535."
    return True, None

# Initial profile data fallback
DEFAULT_PROFILES = [
    {
        "id": "prof-1",
        "name": "Alienware x16 R2 Gaming Rig",
        "group": "Desktops",
        "tags": ["Windows 11", "RTX 4090", "Stealth"],
        "status": "stopped",
        "os": "Windows 11",
        "browser": "Chrome 150",
        "useragent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.7871.128 Safari/537.36",
        "resolution": { "width": 1920, "height": 1080, "dpr": 1 },
        "hardware": { "cpuCores": 16, "memoryGb": 64, "webGlVendor": "Google Inc. (NVIDIA)", "webGlRenderer": "ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 Direct3D11 vs_5_0 ps_5_0)", "canvasNoise": "Noise" },
        "proxy": { "enabled": False, "type": "SOCKS5", "ip": "", "port": "", "location": "Direct Network (India)", "timezone": "Asia/Kolkata", "webrtc": "Proxy IP" },
        "storage": { "cookiesCount": 0, "hasSession": False }
    },
    {
        "id": "prof-2",
        "name": "Dell XPS 15 9530 Ultrabook",
        "group": "Laptops",
        "tags": ["Windows 11", "RTX 4070", "Primary"],
        "status": "stopped",
        "os": "Windows 11",
        "browser": "Chrome 150",
        "useragent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.7871.128 Safari/537.36",
        "resolution": { "width": 1920, "height": 1080, "dpr": 1 },
        "hardware": { "cpuCores": 14, "memoryGb": 32, "webGlVendor": "Google Inc. (NVIDIA)", "webGlRenderer": "ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0)", "canvasNoise": "Noise" },
        "proxy": { "enabled": False, "type": "SOCKS5", "ip": "", "port": "", "location": "Direct Network (India)", "timezone": "Asia/Kolkata", "webrtc": "Proxy IP" },
        "storage": { "cookiesCount": 0, "hasSession": False }
    },
    {
        "id": "prof-3",
        "name": "MacBook Pro 16\" (M3 Max)",
        "group": "Mac",
        "tags": ["macOS", "M3 Max", "Clean"],
        "status": "stopped",
        "os": "macOS Sonoma",
        "browser": "Chrome 150",
        "useragent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.7871.128 Safari/537.36",
        "resolution": { "width": 2560, "height": 1440, "dpr": 2 },
        "hardware": { "cpuCores": 16, "memoryGb": 64, "webGlVendor": "Apple Inc.", "webGlRenderer": "Apple M3 Max", "canvasNoise": "Noise" },
        "proxy": { "enabled": False, "type": "SOCKS5", "ip": "", "port": "", "location": "Direct Network (India)", "timezone": "Asia/Kolkata", "webrtc": "Proxy IP" },
        "storage": { "cookiesCount": 0, "hasSession": False }
    }
]

PROXIES_FILE = os.path.join(os.path.dirname(__file__), 'proxies.json')

def is_port_open(port):
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(0.4)
        res = s.connect_ex(('127.0.0.1', int(port)))
        s.close()
        return res == 0
    except Exception:
        return False

def load_profiles():
    if os.path.exists(PROFILES_FILE):
        try:
            with open(PROFILES_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass
    return DEFAULT_PROFILES

import urllib.request

proxy_health_cache = {}  # proxy_id -> { online: bool, latency: int, lastChecked: timestamp, location: str, timezone: str }
geo_cache = {}           # ip_address -> geolocation dict

def resolve_ip_geolocation(ip_address):
    """Query free IP geolocation API with in-memory caching and fallback to prevent HTTP 429 rate limits."""
    ip_clean = str(ip_address).strip()
    if not ip_clean or ip_clean in ['127.0.0.1', 'localhost', '0.0.0.0', '::1']:
        return {
            'timezone': 'America/New_York',
            'location': 'Direct Network',
            'country': 'United States',
            'countryCode': 'US',
            'city': 'New York',
            'lat': 40.7128,
            'lng': -74.0060,
            'locale': 'en-US',
            'acceptLanguage': 'en-US,en;q=0.9'
        }

    # Return cached IP geolocation if already resolved
    if ip_clean in geo_cache:
        return geo_cache[ip_clean]

    locale_map = {
        'US': ('en-US', 'en-US,en;q=0.9'),
        'GB': ('en-GB', 'en-GB,en;q=0.9,en-US;q=0.8'),
        'CA': ('en-CA', 'en-CA,en-US;q=0.9,en;q=0.8'),
        'AU': ('en-AU', 'en-AU,en-US;q=0.9,en;q=0.8'),
        'DE': ('de-DE', 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7'),
        'FR': ('fr-FR', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7'),
        'JP': ('ja-JP', 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7'),
        'ES': ('es-ES', 'es-ES,es;q=0.9,en-US;q=0.8,en;q=0.7'),
        'BR': ('pt-BR', 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'),
        'IN': ('en-IN', 'en-IN,en;q=0.9,hi;q=0.8,en-US;q=0.7'),
        'RU': ('ru-RU', 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'),
        'CN': ('zh-CN', 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7'),
        'IT': ('it-IT', 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7'),
        'NL': ('nl-NL', 'nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7')
    }

    # Primary: ip-api.com
    try:
        url = f"http://ip-api.com/json/{ip_clean}?fields=status,country,countryCode,city,timezone,lat,lon,query"
        req = urllib.request.Request(url, headers={'User-Agent': 'OmniShield-GeoLookup/1.0'})
        with urllib.request.urlopen(req, timeout=3.0) as response:
            data = json.loads(response.read().decode('utf-8'))
            if data.get('status') == 'success':
                tz = data.get('timezone', 'UTC')
                city = data.get('city', '')
                country = data.get('country', '')
                code = data.get('countryCode', 'US').upper()
                location_str = f"{city}, {code}" if city else country
                loc, lang = locale_map.get(code, ('en-US', 'en-US,en;q=0.9'))

                result = {
                    'timezone': tz,
                    'location': location_str,
                    'country': country,
                    'countryCode': code,
                    'city': city,
                    'lat': data.get('lat', 0.0),
                    'lng': data.get('lon', 0.0),
                    'locale': loc,
                    'acceptLanguage': lang
                }
                geo_cache[ip_clean] = result
                return result
    except Exception:
        pass

    # Secondary Fallback: ipapi.co
    try:
        url = f"https://ipapi.co/{ip_clean}/json/"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
        with urllib.request.urlopen(req, timeout=3.0) as response:
            data = json.loads(response.read().decode('utf-8'))
            if 'timezone' in data:
                tz = data.get('timezone', 'UTC')
                city = data.get('city', '')
                country = data.get('country_name', '')
                code = data.get('country_code', 'US').upper()
                location_str = f"{city}, {code}" if city else country
                loc, lang = locale_map.get(code, ('en-US', 'en-US,en;q=0.9'))

                result = {
                    'timezone': tz,
                    'location': location_str,
                    'country': country,
                    'countryCode': code,
                    'city': city,
                    'lat': data.get('latitude', 0.0),
                    'lng': data.get('longitude', 0.0),
                    'locale': loc,
                    'acceptLanguage': lang
                }
                geo_cache[ip_clean] = result
                return result
    except Exception:
        pass

    fallback_result = {
        'timezone': 'America/New_York',
        'location': f"Proxy ({ip_clean})",
        'country': 'Unknown',
        'countryCode': 'US',
        'city': 'Proxy',
        'lat': 40.7128,
        'lng': -74.0060,
        'locale': 'en-US',
        'acceptLanguage': 'en-US,en;q=0.9'
    }
    # Cache fallback for 60s so rate limits don't spam terminal
    geo_cache[ip_clean] = fallback_result
    return fallback_result

def save_profiles(profiles_data):
    # Auto-derive timezone, locale & acceptLanguage for enabled proxies
    for p in profiles_data:
        proxy = p.get('proxy', {})
        if proxy.get('enabled') and proxy.get('ip'):
            ip = proxy.get('ip', '').strip()
            curr_tz = proxy.get('timezone', '')
            if not curr_tz or curr_tz in ['America/Los_Angeles', 'America/New_York', 'UTC', '']:
                geo = resolve_ip_geolocation(ip)
                if geo and geo.get('timezone'):
                    proxy['timezone'] = geo['timezone']
                    proxy['locale'] = geo['locale']
                    proxy['acceptLanguage'] = geo['acceptLanguage']
                    if not proxy.get('location') or proxy.get('location') in ['Direct Network', 'Direct', '']:
                        proxy['location'] = geo['location']
                    proxy['lat'] = geo['lat']
                    proxy['lng'] = geo['lng']

    with open(PROFILES_FILE, 'w', encoding='utf-8') as f:
        json.dump(profiles_data, f, indent=2)

def load_proxies():
    if os.path.exists(PROXIES_FILE):
        try:
            with open(PROXIES_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass
    return []

def save_proxies(proxies_data):
    with open(PROXIES_FILE, 'w', encoding='utf-8') as f:
        json.dump(proxies_data, f, indent=2)

def _proxy_health_check_loop():
    while True:
        try:
            proxies = load_proxies()
            for px in proxies:
                px_id = px.get('id')
                ip = px.get('ip', '').strip()
                port = px.get('port', '').strip()
                if not ip or not port:
                    continue

                t0 = time.time()
                try:
                    s = socket.create_connection((ip, int(port)), timeout=2.5)
                    s.close()
                    lat = int((time.time() - t0) * 1000)
                    geo = resolve_ip_geolocation(ip)
                    proxy_health_cache[px_id] = {
                        'online': True,
                        'latency': lat,
                        'lastChecked': int(time.time()),
                        'location': geo.get('location', 'Online'),
                        'countryCode': geo.get('countryCode', 'US'),
                        'timezone': geo.get('timezone', 'America/New_York'),
                        'locale': geo.get('locale', 'en-US'),
                        'acceptLanguage': geo.get('acceptLanguage', 'en-US,en;q=0.9')
                    }
                except Exception:
                    proxy_health_cache[px_id] = {
                        'online': False,
                        'latency': -1,
                        'lastChecked': int(time.time()),
                        'location': 'Offline',
                        'countryCode': 'UNKNOWN',
                        'timezone': 'UTC',
                        'locale': 'en-US',
                        'acceptLanguage': 'en-US,en;q=0.9'
                    }
        except Exception as ex:
            print(f"[Proxy Health Check Loop Error] {ex}", flush=True)

        time.sleep(30)

# Start background health checker thread
health_thread = threading.Thread(target=_proxy_health_check_loop, daemon=True)
health_thread.start()

class OmniShieldRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == '/api/profiles':
            profiles = load_profiles()
            # Clean up dead processes using socket check
            to_remove = []
            for pid, info in list(running_processes.items()):
                cdp_port = info.get('port') if isinstance(info, dict) else None
                if cdp_port and not is_port_open(cdp_port):
                    to_remove.append(pid)
            for pid in to_remove:
                if pid in running_processes:
                    del running_processes[pid]

            for p in profiles:
                pid = p.get('id')
                if pid in running_processes:
                    p['status'] = 'running'
                    p['pid'] = f"Port {running_processes[pid].get('port', '')}"
                else:
                    p['status'] = 'stopped'
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                "profiles": profiles,
                "chromePath": CHROME_EXEC,
                "chromeAvailable": CHROME_EXEC is not None
            }).encode('utf-8'))
            return

        elif parsed.path == '/api/proxies':
            proxies = load_proxies()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"proxies": proxies}).encode('utf-8'))
            return

        elif parsed.path == '/api/proxies/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"health": proxy_health_cache}).encode('utf-8'))
            return

        elif parsed.path == '/api/profiles/active':
            active_map = {}
            to_remove = []
            for pid, info in list(running_processes.items()):
                cdp_port = info.get('port') if isinstance(info, dict) else None
                if cdp_port:
                    if is_port_open(cdp_port):
                        active_map[pid] = f"Port {cdp_port}"
                    else:
                        to_remove.append(pid)
                else:
                    active_map[pid] = "Active"
            for pid in to_remove:
                if pid in running_processes:
                    del running_processes[pid]
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"activePids": active_map}).encode('utf-8'))
            return

        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        content_length = int(self.headers.get('Content-Length', 0))
        body_data = self.rfile.read(content_length) if content_length > 0 else b'{}'
        
        try:
            payload = json.loads(body_data.decode('utf-8'))
        except Exception:
            payload = {}

        if parsed.path == '/api/profiles/save':
            profiles = payload.get('profiles', [])
            save_profiles(profiles)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"success": True}).encode('utf-8'))
            return

        elif parsed.path == '/api/proxy/test':
            ptype = payload.get('type', 'HTTP').upper()
            ip = payload.get('ip', '').strip()
            port = payload.get('port', '').strip()
            username = payload.get('username', '').strip()
            password = payload.get('password', '').strip()

            if not ip or not port:
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": "IP Host and Port are required."}).encode('utf-8'))
                return

            import socket, time
            start_t = time.time()
            try:
                s = socket.create_connection((ip, int(port)), timeout=3.0)
                s.close()
                latency = int((time.time() - start_t) * 1000)
                geo = resolve_ip_geolocation(ip)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    "success": True,
                    "latency": latency,
                    "ip": ip,
                    "port": port,
                    "type": ptype,
                    "location": geo.get('location', 'Online'),
                    "timezone": geo.get('timezone', 'America/New_York'),
                    "country": geo.get('country', ''),
                    "city": geo.get('city', ''),
                    "lat": geo.get('lat', 0),
                    "lng": geo.get('lng', 0)
                }).encode('utf-8'))
                return
            except Exception as err:
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    "success": False,
                    "error": f"Connection unreachable on {ip}:{port} ({str(err)})"
                }).encode('utf-8'))
                return

        elif parsed.path == '/api/profiles/launch':
            profile_id = payload.get('id')
            profiles = load_profiles()
            profile = next((p for p in profiles if p['id'] == profile_id), None)

            if not profile:
                logger.error(f"Launch requested for non-existent profile ID: {profile_id}")
                self.send_response(404)
                self.end_headers()
                return

            if not CHROME_EXEC:
                logger.error("Google Chrome executable not found on system!")
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Google Chrome executable not found."}).encode('utf-8'))
                return

            valid, err_msg = validate_launch_inputs(profile)
            if not valid:
                logger.warning(f"Validation error launching profile '{profile_id}': {err_msg}")
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": err_msg}).encode('utf-8'))
                return

            logger.info(f"Launching Chrome Profile: '{profile.get('name')}' (id={profile_id})...")

            safe_name = "".join(c if c.isalnum() else "_" for c in profile['name']).lower()
            user_data_dir = os.path.join(PROFILES_BASE_DIR, f"{profile_id}_{safe_name}")
            os.makedirs(user_data_dir, exist_ok=True)

            lockfile = os.path.join(user_data_dir, 'SingletonLock')
            if os.path.exists(lockfile) or os.path.islink(lockfile):
                try:
                    os.remove(lockfile)
                except Exception:
                    pass

            cdp_port = get_free_cdp_port()

            res = profile.get('resolution', {})
            width = int(res.get('width', 1920))
            height = int(res.get('height', 1080))
            useragent = profile.get('useragent', '')
            proxy = profile.get('proxy', {})

            hardware = profile.get('hardware', {})
            cpu_cores = int(hardware.get('cpuCores', 8))
            memory_gb = int(hardware.get('memoryGb', 16))
            webgl_vendor = hardware.get('webGlVendor', 'Google Inc. (NVIDIA)')
            webgl_renderer = hardware.get('webGlRenderer', 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0)')

            proxy_str = ""
            proxy_user = proxy.get('username', '')
            proxy_pass = proxy.get('password', '')
            proxy_tz = ""

            if proxy.get('enabled') and proxy.get('ip') and proxy.get('port'):
                ip = proxy.get('ip', '').strip()
                port_num = proxy.get('port', '').strip()
                ptype = proxy.get('type', 'socks5').lower()
                proxy_str = f"{ptype}://{ip}:{port_num}"

                geo = resolve_ip_geolocation(ip)
                if geo and geo.get('timezone'):
                    proxy_tz = geo['timezone']
                else:
                    proxy_tz = proxy.get('timezone', 'America/New_York')
            else:
                # Direct network: do NOT override timezone — preserve native system timezone
                proxy_tz = ""

            from stealth_engine import launch_stealth_profile

            def _launch_wrapper():
                try:
                    real_pid, port_used, active_bridge = launch_stealth_profile(
                        profile_id, profile['name'], width, height, useragent,
                        proxy_str, cdp_port, "https://browserleaks.com/canvas",
                        webgl_vendor, webgl_renderer, cpu_cores, memory_gb,
                        proxy_user, proxy_pass, proxy_tz
                    )
                    running_processes[profile_id] = {
                        "pid": real_pid,
                        "port": port_used,
                        "bridge": active_bridge,
                        "user_data_dir": user_data_dir,
                        "name": profile.get('name')
                    }
                    logger.info(f"Profile '{profile.get('name')}' launched successfully (PID={real_pid}, CDP Port={port_used}).")
                except Exception as ex:
                    logger.error(f"[LAUNCH ERROR] {ex}")

            import threading
            t = threading.Thread(target=_launch_wrapper)
            t.daemon = True
            t.start()

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": True,
                "pid": f"Port {cdp_port}",
                "userDataDir": user_data_dir,
                "command": f"python stealth_engine.py ({profile_id})"
            }).encode('utf-8'))
            return

        elif parsed.path == '/api/profiles/stop':
            profile_id = payload.get('id')
            if profile_id in running_processes:
                info = running_processes[profile_id]
                bridge = info.get('bridge')
                if bridge:
                    try:
                        bridge.stop()
                        logger.info(f"[Stop] Closed Proxy Bridge for profile '{profile_id}'")
                    except Exception as b_err:
                        logger.warning(f"[Stop] Error closing Proxy Bridge: {b_err}")

                real_pid = info.get('pid')
                if real_pid and isinstance(real_pid, int):
                    try:
                        if sys.platform == 'win32':
                            subprocess.run(f"taskkill /F /PID {real_pid} /T", shell=True, capture_output=True)
                        else:
                            os.kill(real_pid, signal.SIGKILL)
                        logger.info(f"[Stop] Killed Chrome process PID {real_pid}")
                    except Exception as p_err:
                        logger.warning(f"[Stop] Error killing PID {real_pid}: {p_err}")

                cdp_port = info.get('port')
                if cdp_port:
                    try:
                        result = subprocess.run(
                            f'netstat -ano | findstr "LISTENING" | findstr ":{cdp_port} "',
                            shell=True, capture_output=True, text=True, timeout=3
                        )
                        for line in result.stdout.strip().split('\n'):
                            parts = line.strip().split()
                            if parts:
                                pid_str = parts[-1]
                                if pid_str.isdigit() and int(pid_str) > 0:
                                    subprocess.run(f'taskkill /F /PID {pid_str} /T', shell=True, capture_output=True)
                    except Exception:
                        pass

                del running_processes[profile_id]

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"success": True}).encode('utf-8'))
            return

        elif parsed.path == '/api/proxies/save':
            proxies = payload.get('proxies', [])
            save_proxies(proxies)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"success": True}).encode('utf-8'))
            return

        self.send_response(404)
        self.end_headers()

def reconcile_running_processes():
    """Scans active CDP ports and SingletonLock files on server startup to rebuild running_processes."""
    try:
        profiles = load_profiles()
        for p in profiles:
            prof_id = p.get('id')
            safe_name = "".join(c if c.isalnum() else "_" for c in p['name']).lower()
            user_data_dir = os.path.join(PROFILES_BASE_DIR, f"{prof_id}_{safe_name}")
            lockfile = os.path.join(user_data_dir, 'SingletonLock')
            if os.path.exists(user_data_dir) and (os.path.exists(lockfile) or os.path.islink(lockfile)):
                for cdp_p in range(9200, 9500):
                    if is_port_open(cdp_p):
                        running_processes[prof_id] = {
                            "pid": "Reconciled",
                            "port": cdp_p,
                            "bridge": None,
                            "user_data_dir": user_data_dir,
                            "name": p.get('name')
                        }
                        logger.info(f"[Reconcile] Recovered active profile '{p.get('name')}' on CDP Port {cdp_p}")
                        break
    except Exception as e:
        logger.warning(f"[Reconcile Warning] Could not reconcile processes: {e}")

def clear_port_3000_conflicts():
    """Kills any conflicting process listening on port 3000 before binding."""
    try:
        if sys.platform == 'win32':
            result = subprocess.run(
                'netstat -ano | findstr "LISTENING" | findstr ":3000 "',
                shell=True, capture_output=True, text=True, timeout=3
            )
            my_pid = os.getpid()
            for line in result.stdout.strip().split('\n'):
                parts = line.strip().split()
                if parts:
                    pid_str = parts[-1]
                    if pid_str.isdigit():
                        p_int = int(pid_str)
                        if p_int > 0 and p_int != my_pid:
                            subprocess.run(f'taskkill /F /PID {p_int} /T', shell=True, capture_output=True)
    except Exception:
        pass

if __name__ == '__main__':
    clear_port_3000_conflicts()
    reconcile_running_processes()
    logger.info(f"[OmniShield Engine] Starting server on http://localhost:{PORT}")
    logger.info(f"[OmniShield Engine] Detected Chrome Executable: {CHROME_EXEC}")
    logger.info(f"[OmniShield Engine] Profiles Storage Directory: {PROFILES_BASE_DIR}")
    try:
        server = ThreadingHTTPServer(('0.0.0.0', PORT), OmniShieldRequestHandler)
        server.serve_forever()
    except Exception as e:
        logger.error(f"[Server Error] Could not start server on port {PORT}: {e}")
