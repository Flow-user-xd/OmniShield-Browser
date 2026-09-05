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

def get_chrome_executable():
    global CHROME_EXEC
    for path in CHROME_PATHS:
        if os.path.exists(path):
            CHROME_EXEC = path
            return path
    CHROME_EXEC = None
    return None

CHROME_EXEC = get_chrome_executable()

chromium_install_state = {
    "status": "idle",
    "percent": 0,
    "mb_done": 0,
    "mb_total": 0,
    "label": "",
    "error": None
}

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
    """Returns an unused CDP port, prioritizing standard port 9222 for Puppeteer and Playwright."""
    used_ports = {info.get('port') for info in running_processes.values() if isinstance(info, dict) and info.get('port')}
    preferred_ports = [9222] + list(range(9223, 9500))
    for port in preferred_ports:
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
        except Exception as e:
            logger.warning(f"Error loading {PROFILES_FILE}: {e}. Checking backup file...")
            bak_file = PROFILES_FILE + '.bak'
            if os.path.exists(bak_file):
                try:
                    with open(bak_file, 'r', encoding='utf-8') as bf:
                        data = json.load(bf)
                        logger.info(f"Successfully restored profiles from {bak_file}")
                        return data
                except Exception as be:
                    logger.error(f"Failed to load backup {bak_file}: {be}")
    return DEFAULT_PROFILES

import urllib.request

proxy_health_cache = {}  # proxy_id -> { online: bool, latency: int, lastChecked: timestamp, location: str, timezone: str }
geo_cache = {}           # ip_address -> geolocation dict

def country_code_to_flag(code):
    """Converts 2-letter ISO country code into Unicode flag emoji."""
    if not code or len(code) != 2:
        return '🌐'
    try:
        return chr(127397 + ord(code[0].upper())) + chr(127397 + ord(code[1].upper()))
    except Exception:
        return '🌐'

def resolve_ip_geolocation(ip_address):
    """
    Accurately query IP geolocation APIs with priority given to real-time datacenter/residential
    APNIC/RIPE/ARIN registries (ipwho.is, ipinfo.io) over stale cached records.
    """
    ip_clean = str(ip_address).strip()
    if not ip_clean or ip_clean in ['127.0.0.1', 'localhost', '0.0.0.0', '::1']:
        return {
            'timezone': 'UTC',
            'location': '🌐 Direct Network',
            'country': 'Direct',
            'countryCode': 'LOCAL',
            'city': 'Direct Network',
            'flag': '🌐',
            'lat': 0.0,
            'lng': 0.0,
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

    # Tier 1: ipwho.is (Highest accuracy for datacenter & cloud IP reassignments, returns country, city, flag emoji & timezone)
    try:
        url = f"https://ipwho.is/{ip_clean}"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) OmniShield/1.0'})
        with urllib.request.urlopen(req, timeout=3.5) as response:
            data = json.loads(response.read().decode('utf-8'))
            if data.get('success'):
                code = data.get('country_code', 'US').upper()
                flag = data.get('flag', {}).get('emoji') or country_code_to_flag(code)
                city = data.get('city', '')
                country = data.get('country', code)
                loc_str = f"{flag} {city}, {country}".strip() if city else f"{flag} {country}".strip()
                tz = data.get('timezone', {}).get('id') or ('Asia/Kolkata' if code == 'IN' else 'UTC')
                loc, lang = locale_map.get(code, ('en-US', 'en-US,en;q=0.9'))
                result = {
                    'timezone': tz,
                    'location': loc_str,
                    'country': country,
                    'countryCode': code,
                    'city': city,
                    'flag': flag,
                    'lat': data.get('latitude', 0.0),
                    'lng': data.get('longitude', 0.0),
                    'locale': loc,
                    'acceptLanguage': lang
                }
                geo_cache[ip_clean] = result
                return result
    except Exception:
        pass

    # Tier 2: ipinfo.io (Real-time autonomous system & BGP router geolocation)
    try:
        url = f"https://ipinfo.io/{ip_clean}/json"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=3.5) as response:
            data = json.loads(response.read().decode('utf-8'))
            code = data.get('country', '').upper()
            if code and len(code) == 2:
                flag = country_code_to_flag(code)
                city = data.get('city', '')
                loc_str = f"{flag} {city}, {code}".strip() if city else f"{flag} {code}".strip()
                lat, lng = 0.0, 0.0
                if 'loc' in data and ',' in data['loc']:
                    parts = data['loc'].split(',')
                    lat, lng = float(parts[0]), float(parts[1])
                loc, lang = locale_map.get(code, ('en-US', 'en-US,en;q=0.9'))
                tz = data.get('timezone') or ('Asia/Kolkata' if code == 'IN' else 'UTC')
                result = {
                    'timezone': tz,
                    'location': loc_str,
                    'country': code,
                    'countryCode': code,
                    'city': city,
                    'flag': flag,
                    'lat': lat,
                    'lng': lng,
                    'locale': loc,
                    'acceptLanguage': lang
                }
                geo_cache[ip_clean] = result
                return result
    except Exception:
        pass

    # Tier 3: ip-api.com
    try:
        url = f"http://ip-api.com/json/{ip_clean}?fields=status,country,countryCode,city,timezone,lat,lon,query"
        req = urllib.request.Request(url, headers={'User-Agent': 'OmniShield-GeoLookup/1.0'})
        with urllib.request.urlopen(req, timeout=3.5) as response:
            data = json.loads(response.read().decode('utf-8'))
            if data.get('status') == 'success':
                code = data.get('countryCode', 'US').upper()
                flag = country_code_to_flag(code)
                city = data.get('city', '')
                country = data.get('country', code)
                loc_str = f"{flag} {city}, {country}".strip() if city else f"{flag} {country}".strip()
                loc, lang = locale_map.get(code, ('en-US', 'en-US,en;q=0.9'))
                result = {
                    'timezone': data.get('timezone', 'UTC'),
                    'location': loc_str,
                    'country': country,
                    'countryCode': code,
                    'city': city,
                    'flag': flag,
                    'lat': data.get('lat', 0.0),
                    'lng': data.get('lon', 0.0),
                    'locale': loc,
                    'acceptLanguage': lang
                }
                geo_cache[ip_clean] = result
                return result
    except Exception:
        pass

    fallback_result = {
        'timezone': 'UTC',
        'location': f"🌐 Proxy ({ip_clean})",
        'country': 'Proxy Host',
        'countryCode': 'US',
        'city': 'Proxy',
        'flag': '🌐',
        'lat': 0.0,
        'lng': 0.0,
        'locale': 'en-US',
        'acceptLanguage': 'en-US,en;q=0.9'
    }
    geo_cache[ip_clean] = fallback_result
    return fallback_result

def save_profiles(profiles_data):
    # Auto-derive accurate geolocation, timezone, locale & acceptLanguage for enabled proxies
    for p in profiles_data:
        proxy = p.get('proxy', {})
        if proxy.get('enabled') and proxy.get('ip'):
            ip = proxy.get('ip', '').strip()
            geo = resolve_ip_geolocation(ip)
            if geo:
                proxy['timezone'] = geo.get('timezone') or proxy.get('timezone') or 'UTC'
                proxy['locale'] = geo.get('locale') or proxy.get('locale') or 'en-US'
                proxy['acceptLanguage'] = geo.get('acceptLanguage') or proxy.get('acceptLanguage') or 'en-US,en;q=0.9'
                proxy['countryCode'] = geo.get('countryCode', 'US')
                proxy['country'] = geo.get('country', '')
                proxy['city'] = geo.get('city', '')
                proxy['location'] = geo.get('location') or f"🌐 {ip}:{proxy.get('port', '')}"
                if geo.get('lat'): proxy['lat'] = geo['lat']
                if geo.get('lng'): proxy['lng'] = geo['lng']

    tmp_file = PROFILES_FILE + '.tmp'
    bak_file = PROFILES_FILE + '.bak'
    try:
        with open(tmp_file, 'w', encoding='utf-8') as f:
            json.dump(profiles_data, f, indent=2)
        if os.path.exists(PROFILES_FILE):
            try:
                import shutil
                shutil.copyfile(PROFILES_FILE, bak_file)
            except Exception:
                pass
        os.replace(tmp_file, PROFILES_FILE)
    except Exception as e:
        logger.error(f"Atomic save error for {PROFILES_FILE}: {e}")
        try:
            with open(PROFILES_FILE, 'w', encoding='utf-8') as f:
                json.dump(profiles_data, f, indent=2)
        except Exception:
            pass

def load_proxies():
    if os.path.exists(PROXIES_FILE):
        try:
            with open(PROXIES_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            bak_file = PROXIES_FILE + '.bak'
            if os.path.exists(bak_file):
                try:
                    with open(bak_file, 'r', encoding='utf-8') as bf:
                        return json.load(bf)
                except Exception:
                    pass
    return []

def save_proxies(proxies_data):
    tmp_file = PROXIES_FILE + '.tmp'
    bak_file = PROXIES_FILE + '.bak'
    try:
        with open(tmp_file, 'w', encoding='utf-8') as f:
            json.dump(proxies_data, f, indent=2)
        if os.path.exists(PROXIES_FILE):
            try:
                import shutil
                shutil.copyfile(PROXIES_FILE, bak_file)
            except Exception:
                pass
        os.replace(tmp_file, PROXIES_FILE)
    except Exception as e:
        logger.error(f"Atomic save error for {PROXIES_FILE}: {e}")
        try:
            with open(PROXIES_FILE, 'w', encoding='utf-8') as f:
                json.dump(proxies_data, f, indent=2)
        except Exception:
            pass

def get_profile_cookies_db(profile_id):
    if not profile_id:
        return None
    if os.path.exists(PROFILES_BASE_DIR):
        for entry in os.listdir(PROFILES_BASE_DIR):
            if entry.startswith(profile_id):
                return os.path.join(PROFILES_BASE_DIR, entry, 'Default', 'Network', 'Cookies')
    return os.path.join(PROFILES_BASE_DIR, f"{profile_id}_profile", 'Default', 'Network', 'Cookies')

def import_profile_cookies(profile_id, cookie_input):
    db_path = get_profile_cookies_db(profile_id)
    if not db_path:
        return 0
    os.makedirs(os.path.dirname(db_path), exist_ok=True)

    parsed = []
    if isinstance(cookie_input, str):
        s = cookie_input.strip()
        if s.startswith('[') or s.startswith('{'):
            try:
                d = json.loads(s)
                parsed = d if isinstance(d, list) else [d]
            except Exception:
                pass
        if not parsed:
            for line in s.splitlines():
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                parts = line.split('\t')
                if len(parts) >= 7:
                    parsed.append({
                        "domain": parts[0],
                        "path": parts[2],
                        "secure": parts[3].upper() == 'TRUE',
                        "expires": float(parts[4]) if parts[4].replace('.', '', 1).isdigit() else 0,
                        "name": parts[5],
                        "value": parts[6]
                    })
    elif isinstance(cookie_input, list):
        parsed = cookie_input

    if not parsed:
        return 0

    now_unix = time.time()
    now_chrome = int((now_unix + 11644473600) * 1000000)

    import sqlite3
    conn = sqlite3.connect(db_path, timeout=5.0)
    try:
        cur = conn.cursor()
        cur.execute('''
            CREATE TABLE IF NOT EXISTS cookies(
                creation_utc INTEGER NOT NULL,
                host_key TEXT NOT NULL,
                top_frame_site_key TEXT NOT NULL DEFAULT '',
                name TEXT NOT NULL,
                value TEXT NOT NULL,
                encrypted_value BLOB NOT NULL DEFAULT '',
                path TEXT NOT NULL DEFAULT '/',
                expires_utc INTEGER NOT NULL DEFAULT 0,
                is_secure INTEGER NOT NULL DEFAULT 0,
                is_httponly INTEGER NOT NULL DEFAULT 0,
                last_access_utc INTEGER NOT NULL DEFAULT 0,
                has_expires INTEGER NOT NULL DEFAULT 1,
                is_persistent INTEGER NOT NULL DEFAULT 1,
                priority INTEGER NOT NULL DEFAULT 1,
                samesite INTEGER NOT NULL DEFAULT -1,
                source_scheme INTEGER NOT NULL DEFAULT 2,
                source_port INTEGER NOT NULL DEFAULT 443,
                is_same_party INTEGER NOT NULL DEFAULT 0,
                last_update_utc INTEGER NOT NULL DEFAULT 0,
                source_type INTEGER NOT NULL DEFAULT 0
            )
        ''')

        cur.execute("PRAGMA table_info(cookies)")
        existing_cols = set(r[1] for r in cur.fetchall())

        count = 0
        for c in parsed:
            name = c.get('name') or c.get('Name') or ''
            val = c.get('value') or c.get('Value') or ''
            dom = c.get('domain') or c.get('Domain') or c.get('host') or ''
            path = c.get('path') or c.get('Path') or '/'
            sec = 1 if c.get('secure') or c.get('is_secure') else 0
            httponly = 1 if c.get('httpOnly') or c.get('is_httponly') else 0
            exp = c.get('expirationDate') or c.get('expires') or 0
            exp_chrome = int((float(exp) + 11644473600) * 1000000) if exp and float(exp) > 0 else 0

            if name and dom:
                col_map = {
                    'creation_utc': now_chrome,
                    'host_key': dom,
                    'top_frame_site_key': '',
                    'name': name,
                    'value': val,
                    'encrypted_value': b'',
                    'path': path,
                    'expires_utc': exp_chrome,
                    'is_secure': sec,
                    'is_httponly': httponly,
                    'last_access_utc': now_chrome,
                    'has_expires': 1 if exp_chrome > 0 else 0,
                    'is_persistent': 1,
                    'priority': 1,
                    'samesite': -1,
                    'source_scheme': 2,
                    'source_port': 443,
                    'last_update_utc': now_chrome,
                    'source_type': 0,
                    'has_cross_site_ancestor': 0
                }
                cols_to_insert = [k for k in col_map if k in existing_cols]
                placeholders = ', '.join(['?'] * len(cols_to_insert))
                sql = f"INSERT INTO cookies ({', '.join(cols_to_insert)}) VALUES ({placeholders})"
                cur.execute(sql, [col_map[k] for k in cols_to_insert])
                count += 1

        conn.commit()
    finally:
        conn.close()

    try:
        profs = load_profiles()
        for p in profs:
            if p.get('id') == profile_id:
                if 'storage' not in p:
                    p['storage'] = {}
                p['storage']['cookiesCount'] = (p['storage'].get('cookiesCount', 0) or 0) + count
        save_profiles(profs)
    except Exception:
        pass

    return count

def export_profile_cookies(profile_id):
    db_path = get_profile_cookies_db(profile_id)
    if not db_path or not os.path.exists(db_path):
        return []
    try:
        import sqlite3
        conn = sqlite3.connect(db_path, timeout=5.0)
        try:
            cur = conn.cursor()
            cur.execute("SELECT host_key, name, value, path, expires_utc, is_secure, is_httponly FROM cookies")
            rows = cur.fetchall()
        finally:
            conn.close()
        out = []
        for r in rows:
            exp_unix = int((r[4] / 1000000) - 11644473600) if r[4] > 0 else 0
            out.append({
                "domain": r[0],
                "name": r[1],
                "value": r[2],
                "path": r[3],
                "expirationDate": exp_unix,
                "secure": bool(r[5]),
                "httpOnly": bool(r[6])
            })
        return out
    except Exception as e:
        logger.warning(f"[Cookie Export] Error reading cookies: {e}")
        return []

def clear_profile_cookies(profile_id):
    db_path = get_profile_cookies_db(profile_id)
    if db_path and os.path.exists(db_path):
        try:
            import sqlite3
            conn = sqlite3.connect(db_path, timeout=5.0)
            try:
                cur = conn.cursor()
                cur.execute("DELETE FROM cookies")
                conn.commit()
            finally:
                conn.close()
        except sqlite3.OperationalError:
            return False, "Profile is currently running and locking the database. Please close the profile before clearing cookies."
        except Exception as e:
            return False, str(e)
    try:
        profs = load_profiles()
        for p in profs:
            if p.get('id') == profile_id:
                if 'storage' in p:
                    p['storage']['cookiesCount'] = 0
        save_profiles(profs)
    except Exception:
        pass
    return True, None

def test_single_proxy(px):
    ip = px.get('ip', '').strip()
    port = px.get('port', '').strip()
    current_type = px.get('type', 'SOCKS5').upper()
    if not ip or not port:
        return { "ip": ip, "port": port, "status": "offline", "latency": None, "error": "Missing IP or port" }

    detected_type = current_type
    lat = None
    is_online = False

    # Probe protocols: try current type first, then alternate
    types_to_try = [current_type]
    alt_type = 'HTTP' if current_type.startswith('SOCKS') else 'SOCKS5'
    types_to_try.append(alt_type)

    for candidate in types_to_try:
        t0 = time.time()
        try:
            s = socket.create_connection((ip, int(port)), timeout=2.5)
            s.settimeout(2.5)
            if candidate.startswith('SOCKS'):
                # SOCKS5 Handshake greeting
                s.sendall(b"\x05\x02\x00\x02")
                resp = s.recv(2)
                if len(resp) >= 2 and resp[0] == 5:
                    lat = int((time.time() - t0) * 1000)
                    detected_type = 'SOCKS5'
                    is_online = True
                    s.close()
                    break
            else:
                # HTTP Proxy CONNECT probe
                s.sendall(b"CONNECT www.google.com:443 HTTP/1.1\r\nHost: www.google.com:443\r\n\r\n")
                resp = s.recv(16)
                if resp.startswith(b"HTTP/"):
                    lat = int((time.time() - t0) * 1000)
                    detected_type = 'HTTP'
                    is_online = True
                    s.close()
                    break
            s.close()
        except Exception:
            pass

    # If handshakes timed out but raw TCP port connects:
    if not is_online:
        t0 = time.time()
        try:
            s = socket.create_connection((ip, int(port)), timeout=2.5)
            s.close()
            lat = int((time.time() - t0) * 1000)
            is_online = True
            port_num = int(port)
            if port_num in [80, 8080, 3128, 8000, 8888, 8081, 8085, 8443]:
                detected_type = 'HTTP'
            elif port_num in [1080, 1081, 9050, 9150, 1085]:
                detected_type = 'SOCKS5'
            else:
                detected_type = current_type
        except Exception as err:
            return {
                "id": px.get('id'),
                "ip": ip,
                "port": port,
                "type": current_type,
                "detectedType": current_type,
                "status": "offline",
                "latency": None,
                "error": str(err)
            }

    geo = resolve_ip_geolocation(ip)
    flag = geo.get('flag') or country_code_to_flag(geo.get('countryCode', ''))
    city = geo.get('city', '')
    country = geo.get('country', geo.get('countryCode', 'Online'))
    loc_display = geo.get('location') or f"{flag} {city + ', ' if city else ''}{country}".strip()

    return {
        "id": px.get('id'),
        "ip": ip,
        "port": port,
        "type": detected_type,
        "detectedType": detected_type,
        "typeChanged": detected_type != current_type,
        "status": "online",
        "latency": lat or 45,
        "location": loc_display,
        "country": country,
        "countryCode": geo.get('countryCode', 'US'),
        "city": city,
        "timezone": geo.get('timezone', 'UTC')
    }

def test_all_proxies_concurrent(proxies_list):
    import concurrent.futures
    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
        results = list(executor.map(test_single_proxy, proxies_list))

    # Auto-update saved proxies pool if protocol or location was corrected/updated
    try:
        saved = load_proxies()
        changed = False
        res_map = {f"{r.get('ip')}:{r.get('port')}": r for r in results if r.get('status') == 'online'}
        for sp in saved:
            key = f"{sp.get('ip')}:{sp.get('port')}"
            if key in res_map:
                r = res_map[key]
                if r.get('detectedType') and r['detectedType'] != sp.get('type'):
                    sp['type'] = r['detectedType']
                    changed = True
                if r.get('location'):
                    sp['location'] = r['location']
                    changed = True
                if r.get('latency'):
                    sp['latency'] = r['latency']
                    changed = True
        if changed:
            save_proxies(saved)
    except Exception:
        pass

    return results

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

                res = test_single_proxy(px)
                if res.get('status') == 'online':
                    proxy_health_cache[px_id] = {
                        'online': True,
                        'latency': res.get('latency', 50),
                        'lastChecked': int(time.time()),
                        'type': res.get('detectedType', px.get('type', 'SOCKS5')),
                        'location': res.get('location', 'Online'),
                        'countryCode': res.get('countryCode', 'US'),
                        'timezone': res.get('timezone', 'America/New_York')
                    }
                else:
                    proxy_health_cache[px_id] = {
                        'online': False,
                        'latency': -1,
                        'lastChecked': int(time.time()),
                        'type': px.get('type', 'SOCKS5'),
                        'location': 'Offline',
                        'countryCode': 'UNKNOWN',
                        'timezone': 'UTC'
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
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
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
                "profilesDir": PROFILES_BASE_DIR,
                "chromeAvailable": CHROME_EXEC is not None
            }).encode('utf-8'))
            return

        elif parsed.path == '/api/profile/prepare-cli':
            from urllib.parse import parse_qs
            qs = parse_qs(parsed.query)
            prof_id = qs.get('id', [''])[0]
            profiles = load_profiles()
            prof = next((p for p in profiles if p.get('id') == prof_id), None)
            if prof:
                safe_name = "".join(c if c.isalnum() else "_" for c in prof.get('name', 'profile')).lower()
                user_data_dir = os.path.join(PROFILES_BASE_DIR, f"{prof_id}_{safe_name}")
                os.makedirs(user_data_dir, exist_ok=True)
                
                px_cfg = prof.get('proxy', {})
                px_locale = px_cfg.get('locale') or prof.get('locale', '')
                px_accept_lang = px_cfg.get('acceptLanguage') or prof.get('acceptLanguage', '')
                px_webrtc = px_cfg.get('webrtc', 'Proxy IP')
                px_tz = px_cfg.get('timezone', '')

                from stealth_engine import prepare_profile_extension
                ext_dir = prepare_profile_extension(
                    profile_id=prof_id,
                    user_data_dir=user_data_dir,
                    webgl_vendor=prof.get('hardware', {}).get('webGlVendor', 'Google Inc. (NVIDIA)'),
                    webgl_renderer=prof.get('hardware', {}).get('webGlRenderer', 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 Direct3D11 vs_5_0 ps_5_0)'),
                    cpu_cores=prof.get('hardware', {}).get('cpuCores', 8),
                    memory_gb=prof.get('hardware', {}).get('memoryGb', 16),
                    timezone_id=px_tz,
                    width=prof.get('resolution', {}).get('width', 1920),
                    height=prof.get('resolution', {}).get('height', 1080),
                    useragent=prof.get('useragent', ''),
                    fingerprint_seed=prof.get('fingerprintSeed') or prof.get('canvasSeed') or prof_id,
                    locale=px_locale,
                    accept_language=px_accept_lang,
                    webrtc=px_webrtc
                )

                has_proxy = px_cfg.get('enabled') and px_cfg.get('ip')
                px_flag = '--no-proxy-server'
                if has_proxy:
                    ptype = (px_cfg.get('type') or 'http').lower()
                    px_ip = px_cfg.get('ip')
                    px_port = px_cfg.get('port')
                    px_flag = f'--proxy-server="{ptype}://{px_ip}:{px_port}" --force-webrtc-ip-handling-policy=disable_non_proxied_udp'

                bat_path = os.path.join(user_data_dir, "launch.bat")
                w_val = prof.get("resolution", {}).get("width", 1920)
                h_val = prof.get("resolution", {}).get("height", 1080)
                ua_val = prof.get("useragent", "")

                from stealth_engine import resolve_and_unpack_extension
                custom_exts = prof.get("customExtensions") or []
                valid_custom_exts = []
                for e in custom_exts:
                    resolved = resolve_and_unpack_extension(e, user_data_dir)
                    if resolved and resolved not in valid_custom_exts:
                        valid_custom_exts.append(resolved)
                all_exts = [ext_dir] + valid_custom_exts
                ext_list_str = ','.join(all_exts)

                tz_env_line = f"set TZ={px_tz}\r\n" if px_tz else ""
                lang_flag = f'--lang={px_locale} ' if px_locale else ""
                target_start_url = prof.get("startUrl") or "about:blank"

                bat_content = f'@echo off\r\ntitle OmniShield - {prof.get("name")}\r\necho Starting OmniShield Profile: {prof.get("name")}...\r\n{tz_env_line}start "" "{CHROME_EXEC}" --user-data-dir="{user_data_dir}" --remote-debugging-port=9222 --remote-allow-origins=* --load-extension="{ext_list_str}" --extension-mime-request-handling=always-prompt-for-install --enable-extensions --silent-debugger-extension-api --window-size={w_val},{h_val} --user-agent="{ua_val}" {lang_flag}{px_flag} --no-first-run --no-default-browser-check {target_start_url}\r\n'
                try:
                    with open(bat_path, 'w', encoding='utf-8') as bf:
                        bf.write(bat_content)
                except Exception:
                    pass

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    "success": True,
                    "userDataDir": user_data_dir,
                    "extensionDir": ext_dir,
                    "chromePath": CHROME_EXEC,
                    "launcherPath": bat_path
                }).encode('utf-8'))
                return
            else:
                self.send_response(404)
                self.end_headers()
                return

        elif parsed.path == '/api/profile/download-launcher':
            from urllib.parse import parse_qs
            qs = parse_qs(parsed.query)
            prof_id = qs.get('id', [''])[0]
            profiles = load_profiles()
            prof = next((p for p in profiles if p.get('id') == prof_id), None)
            if prof:
                safe_name = "".join(c if c.isalnum() else "_" for c in prof.get('name', 'profile')).lower()
                user_data_dir = os.path.join(PROFILES_BASE_DIR, f"{prof_id}_{safe_name}")
                bat_path = os.path.join(user_data_dir, "launch.bat")
                if os.path.exists(bat_path):
                    with open(bat_path, 'r', encoding='utf-8') as bf:
                        bat_content = bf.read()
                    if '--extensions-on-chrome-urls' in bat_content or '--disable-popup-blocking' in bat_content:
                        bat_content = bat_content.replace('--extensions-on-chrome-urls', '').replace('--disable-popup-blocking', '')
                        try:
                            with open(bat_path, 'w', encoding='utf-8') as bf:
                                bf.write(bat_content)
                        except Exception:
                            pass
                else:
                    target_start_url = prof.get("startUrl") or "about:blank"
                    bat_content = f'@echo off\r\ntitle OmniShield - {prof.get("name")}\r\necho Starting OmniShield Profile...\r\nstart "" "{CHROME_EXEC}" --user-data-dir="{user_data_dir}" --no-first-run {target_start_url}\r\n'

                self.send_response(200)
                self.send_header('Content-Type', 'application/x-bat')
                self.send_header('Content-Disposition', f'attachment; filename="launch_{safe_name}.bat"')
                self.end_headers()
                self.wfile.write(bat_content.encode('utf-8'))
                return
            else:
                self.send_response(404)
                self.end_headers()
                return

        elif parsed.path == '/api/profile/resolve-proxy-geo':
            from urllib.parse import parse_qs
            qs = parse_qs(parsed.query)
            ip = qs.get('ip', [''])[0].strip()
            geo = resolve_ip_geolocation(ip)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(geo).encode('utf-8'))
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

        elif parsed.path == '/api/profiles/cookies/export':
            from urllib.parse import parse_qs
            qs = parse_qs(parsed.query)
            profile_id = qs.get('id', [''])[0]
            cookies = export_profile_cookies(profile_id)
            prof_name = ""
            for p in load_profiles():
                if p.get('id') == profile_id:
                    prof_name = p.get('name', '')
                    break
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": True,
                "cookies": cookies,
                "profileName": prof_name,
                "profileId": profile_id
            }).encode('utf-8'))
            return

        elif parsed.path == '/api/system/chromium-versions':
            from setup_portable_chromium import fetch_latest_releases
            versions = fetch_latest_releases(3)
            current_chrome = get_chrome_executable()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                "versions": versions,
                "chromeAvailable": current_chrome is not None,
                "chromePath": current_chrome,
                "installState": chromium_install_state
            }).encode('utf-8'))
            return

        elif parsed.path == '/api/system/chromium-status':
            current_chrome = get_chrome_executable()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                "chromeAvailable": current_chrome is not None,
                "chromePath": current_chrome,
                "installState": chromium_install_state
            }).encode('utf-8'))
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
            self.wfile.write(json.dumps({"success": True, "profiles": profiles}).encode('utf-8'))
            return

        elif parsed.path == '/api/system/install-chromium':
            selected_ver = payload.get('version')
            selected_url = payload.get('url')

            if chromium_install_state.get('status') in ('downloading', 'extracting', 'starting'):
                self.send_response(409)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Chromium installation already in progress."}).encode('utf-8'))
                return

            def run_installer():
                global chromium_install_state, CHROME_EXEC
                from setup_portable_chromium import download_and_setup_portable_chromium
                def cb(info):
                    chromium_install_state.update(info)
                try:
                    chromium_install_state = {"status": "starting", "percent": 0, "mb_done": 0, "mb_total": 0, "label": "", "error": None}
                    download_and_setup_portable_chromium(force_interactive=False, chosen_version=selected_ver, progress_callback=cb)
                    CHROME_EXEC = get_chrome_executable()
                    try:
                        import stealth_engine
                        stealth_engine.CHROME_EXEC = CHROME_EXEC
                    except Exception:
                        pass
                except Exception as ex:
                    chromium_install_state = {"status": "error", "error": str(ex), "percent": 0}

            t = threading.Thread(target=run_installer, daemon=True)
            t.start()

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "message": "Chromium download started"}).encode('utf-8'))
            return

        elif parsed.path == '/api/proxy/test':
            res = test_single_proxy(payload)
            if res.get('status') == 'online':
                # Update saved proxies if exists
                try:
                    proxies = load_proxies()
                    updated = False
                    for px in proxies:
                        if px.get('ip') == payload.get('ip') and str(px.get('port')) == str(payload.get('port')):
                            if res.get('detectedType') and px.get('type') != res.get('detectedType'):
                                px['type'] = res.get('detectedType')
                                updated = True
                            if res.get('location'):
                                px['location'] = res.get('location')
                                updated = True
                            if res.get('latency'):
                                px['latency'] = res.get('latency')
                                updated = True
                            if res.get('countryCode'):
                                px['countryCode'] = res.get('countryCode')
                                updated = True
                            if res.get('city'):
                                px['city'] = res.get('city')
                                updated = True
                            if res.get('country'):
                                px['country'] = res.get('country')
                                updated = True
                            if res.get('timezone'):
                                px['timezone'] = res.get('timezone')
                                updated = True
                    if updated:
                        save_proxies(proxies)
                except Exception:
                    pass
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    "success": True,
                    "latency": res.get('latency'),
                    "ip": res.get('ip'),
                    "port": res.get('port'),
                    "type": res.get('type'),
                    "detectedType": res.get('detectedType'),
                    "typeChanged": res.get('typeChanged', False),
                    "location": res.get('location', 'Online'),
                    "country": res.get('country', ''),
                    "countryCode": res.get('countryCode', 'US'),
                    "city": res.get('city', ''),
                    "timezone": res.get('timezone', 'UTC')
                }).encode('utf-8'))
                return
            else:
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    "success": False,
                    "error": res.get('error', 'Connection failed')
                }).encode('utf-8'))
                return

        elif parsed.path == '/api/profiles/cookies/import':
            import sqlite3
            profile_id = payload.get('id')
            raw_cookies = payload.get('cookies')
            try:
                imported_count = import_profile_cookies(profile_id, raw_cookies)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"success": True, "count": imported_count}).encode('utf-8'))
            except sqlite3.OperationalError:
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    "success": False,
                    "error": "Profile is currently running and locking the database. Please close the profile before importing cookies."
                }).encode('utf-8'))
            except Exception as e:
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode('utf-8'))
            return

        elif parsed.path == '/api/profiles/cookies/clear':
            profile_id = payload.get('id')
            success, err = clear_profile_cookies(profile_id)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            if success:
                self.wfile.write(json.dumps({"success": True}).encode('utf-8'))
            else:
                self.wfile.write(json.dumps({"success": False, "error": err}).encode('utf-8'))
            return

        elif parsed.path == '/api/proxies/test-all':
            proxies_list = payload.get('proxies', [])
            results = test_all_proxies_concurrent(proxies_list)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "results": results}).encode('utf-8'))
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

            CHROME_EXEC = get_chrome_executable()
            if not CHROME_EXEC:
                logger.error("Google Chrome or Chromium executable not found on system!")
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    "error": "Chromium browser core is not installed. Please install one of the latest 3 versions.",
                    "notInstalled": True
                }).encode('utf-8'))
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

            for s_file in ['SingletonLock', 'SingletonCookie', 'SingletonSocket']:
                s_path = os.path.join(user_data_dir, s_file)
                if os.path.exists(s_path) or os.path.islink(s_path):
                    try:
                        os.remove(s_path)
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
            proxy_locale = proxy.get('locale', '') or profile.get('locale', '')
            proxy_accept_lang = proxy.get('acceptLanguage', '') or profile.get('acceptLanguage', '')
            webrtc_mode = proxy.get('webrtc', 'Proxy IP')

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

                if not proxy_locale and geo and geo.get('locale'):
                    proxy_locale = geo['locale']
                if not proxy_accept_lang and geo and geo.get('acceptLanguage'):
                    proxy_accept_lang = geo['acceptLanguage']
            else:
                # Direct network: do NOT override timezone — preserve native system timezone
                proxy_tz = ""

            from stealth_engine import launch_stealth_profile

            def _launch_wrapper():
                try:
                    launch_url = profile.get('startUrl') or "about:blank"
                    real_pid, port_used, active_bridge = launch_stealth_profile(
                        profile_id, profile['name'], width, height, useragent,
                        proxy_str, cdp_port, launch_url,
                        webgl_vendor, webgl_renderer, cpu_cores, memory_gb,
                        proxy_user, proxy_pass, proxy_tz,
                        custom_extensions=profile.get('customExtensions') or [],
                        fingerprint_seed=profile.get('fingerprintSeed') or profile.get('canvasSeed') or profile_id,
                        locale=proxy_locale,
                        accept_language=proxy_accept_lang,
                        webrtc=webrtc_mode
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
                "port": cdp_port,
                "wsEndpoint": f"http://127.0.0.1:{cdp_port}",
                "userDataDir": user_data_dir,
                "command": f"python stealth_engine.py ({profile_id})"
            }).encode('utf-8'))
            return

        elif parsed.path == '/api/profiles/stop':
            profile_id = payload.get('id')
            user_data_dir = None

            if profile_id in running_processes:
                info = running_processes[profile_id]
                user_data_dir = info.get('user_data_dir')
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
                            'netstat -ano',
                            shell=True, capture_output=True, text=True, timeout=3
                        )
                        my_pid = os.getpid()
                        for line in result.stdout.strip().splitlines():
                            parts = line.strip().split()
                            if len(parts) >= 5 and 'LISTENING' in parts:
                                local_addr = parts[1]
                                port_part = local_addr.rsplit(':', 1)[-1]
                                if port_part == str(cdp_port):
                                    pid_str = parts[-1]
                                    if pid_str.isdigit() and int(pid_str) > 0 and int(pid_str) != my_pid:
                                        subprocess.run(f'taskkill /F /PID {pid_str} /T', shell=True, capture_output=True)
                    except Exception as net_err:
                        logger.warning(f"[Stop] Error freeing CDP port {cdp_port}: {net_err}")

                del running_processes[profile_id]

            # Resolve user_data_dir if not found in running_processes (e.g. server restart)
            if not user_data_dir:
                try:
                    for p in load_profiles():
                        if p.get('id') == profile_id:
                            safe_name = "".join(c if c.isalnum() else "_" for c in p['name']).lower()
                            candidate_dir = os.path.join(PROFILES_BASE_DIR, f"{profile_id}_{safe_name}")
                            if os.path.exists(candidate_dir):
                                user_data_dir = candidate_dir
                            break
                except Exception:
                    pass

            # Clean up Chromium Singleton lockfiles so profile can relaunch cleanly without crash alerts
            if user_data_dir and os.path.exists(user_data_dir):
                time.sleep(0.3)
                for lockfile in ['SingletonLock', 'SingletonCookie', 'SingletonSocket']:
                    lf_path = os.path.join(user_data_dir, lockfile)
                    try:
                        if os.path.exists(lf_path) or os.path.islink(lf_path):
                            os.remove(lf_path)
                    except Exception:
                        pass

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
        reconciled_ports = set()
        for p in profiles:
            prof_id = p.get('id')
            safe_name = "".join(c if c.isalnum() else "_" for c in p['name']).lower()
            user_data_dir = os.path.join(PROFILES_BASE_DIR, f"{prof_id}_{safe_name}")
            lockfile = os.path.join(user_data_dir, 'SingletonLock')
            if os.path.exists(user_data_dir) and (os.path.exists(lockfile) or os.path.islink(lockfile)):
                for cdp_p in range(9200, 9500):
                    if cdp_p not in reconciled_ports and is_port_open(cdp_p):
                        reconciled_ports.add(cdp_p)
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
                'netstat -ano | findstr :3000',
                shell=True, capture_output=True, text=True, timeout=3
            )
            my_pid = os.getpid()
            for line in result.stdout.strip().split('\n'):
                line = line.strip()
                if 'LISTENING' in line:
                    parts = line.split()
                    if len(parts) >= 5:
                        local_addr = parts[1]
                        # Ensure it specifically binds to port 3000 (not 30000, 13000, etc.)
                        if local_addr.rsplit(':', 1)[-1] == '3000':
                            pid_str = parts[-1]
                            if pid_str.isdigit():
                                p_int = int(pid_str)
                                if p_int > 0 and p_int != my_pid:
                                    logger.info(f"[Conflict] Terminating conflicting process PID {p_int} on port 3000...")
                                    subprocess.run(f'taskkill /F /PID {p_int} /T', shell=True, capture_output=True)
                                    time.sleep(0.5)
    except Exception as e:
        logger.warning(f"[Conflict Warning] Could not clear port 3000 conflicts: {e}")

if __name__ == '__main__':
    clear_port_3000_conflicts()
    reconcile_running_processes()
    logger.info(f"[OmniShield Engine] Starting server on http://localhost:{PORT}")
    logger.info(f"[OmniShield Engine] Detected Chrome Executable: {CHROME_EXEC}")
    logger.info(f"[OmniShield Engine] Profiles Storage Directory: {PROFILES_BASE_DIR}")
    try:
        try:
            server = ThreadingHTTPServer(('0.0.0.0', PORT), OmniShieldRequestHandler)
        except OSError:
            logger.info("[OmniShield Engine] Port 3000 busy, clearing conflicts and retrying...")
            clear_port_3000_conflicts()
            time.sleep(1.0)
            server = ThreadingHTTPServer(('0.0.0.0', PORT), OmniShieldRequestHandler)

        if '--no-browser' not in sys.argv:
            def _auto_open_dashboard():
                time.sleep(0.5)
                import webbrowser
                try:
                    webbrowser.open(f"http://localhost:{PORT}")
                except Exception:
                    pass
            threading.Thread(target=_auto_open_dashboard, daemon=True).start()

        server.serve_forever()
    except Exception as e:
        logger.error(f"[Server Error] Could not start server on port {PORT}: {e}")
