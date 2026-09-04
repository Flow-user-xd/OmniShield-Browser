import os
import sys
import json
import time
import re
import hashlib
import shutil
import asyncio
import subprocess
import urllib.request
try:
    import websockets
except ImportError:
    websockets = None

PORTABLE_CHROMIUM = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'browser_core', 'chrome.exe')

BROWSER_CANDIDATES = [
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
for b_path in BROWSER_CANDIDATES:
    if os.path.exists(b_path):
        CHROME_EXEC = b_path
        break

if not CHROME_EXEC:
    CHROME_EXEC = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

PROFILES_DIR = os.path.join(os.path.expanduser('~'), 'OmniShieldProfiles')
EXTENSION_TEMPLATE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'omnishield_extension')
os.makedirs(PROFILES_DIR, exist_ok=True)


def compute_profile_fingerprint_seeds(seed_str):
    """Compute unique fingerprint noise seeds from seed string or profile ID using SHA256."""
    hash_val = int(hashlib.sha256(str(seed_str).encode('utf-8')).hexdigest(), 16)
    # Generate -1, 0, or +1 micro-noise delta per channel: subtle, zero visual artifacts, non-wrapping
    r_delta = ((hash_val) % 3) - 1
    g_delta = ((hash_val >> 8) % 3) - 1
    b_delta = ((hash_val >> 16) % 3) - 1
    if r_delta == 0 and g_delta == 0 and b_delta == 0:
        r_delta = 1
    return {
        'canvasR': r_delta,
        'canvasG': g_delta,
        'canvasB': b_delta,
        'canvasStride': ((hash_val >> 24) % 8) + 4,   # 4-11 (pixel stride)
        'audioNoise': ((hash_val >> 32) % 900 + 100) / 10000000000.0,  # unique tiny float per profile
    }


def resolve_and_unpack_extension(ext_path, user_data_dir):
    """
    Ensures an extension path points to a valid directory containing manifest.json.
    Automatically handles:
    - Direct extension folders with manifest.json.
    - Subdirectories (dist/, build/, extension/, etc.).
    - ZIP archives (.zip) extracted into unpacked_extensions.
    - CRX packages (.crx CRX2/CRX3) extracted into unpacked_extensions.
    """
    if not ext_path or not isinstance(ext_path, str):
        return None
    ext_path = ext_path.strip()
    if not os.path.exists(ext_path):
        return None

    import zipfile, struct, io

    # 1. Unpack CRX or ZIP files
    if os.path.isfile(ext_path):
        unpack_base = os.path.join(user_data_dir, 'unpacked_extensions')
        os.makedirs(unpack_base, exist_ok=True)
        base_name = "".join(c if c.isalnum() else "_" for c in os.path.splitext(os.path.basename(ext_path))[0])
        target_dir = os.path.join(unpack_base, base_name)

        try:
            with open(ext_path, 'rb') as f:
                header = f.read(16)

            zip_bytes = None
            if header.startswith(b'Cr24'):
                # CRX file parsing
                version = struct.unpack('<I', header[4:8])[0]
                with open(ext_path, 'rb') as f:
                    full_data = f.read()
                if version == 3:
                    header_len = struct.unpack('<I', full_data[8:12])[0]
                    zip_offset = 12 + header_len
                    zip_bytes = io.BytesIO(full_data[zip_offset:])
                elif version == 2:
                    pub_len = struct.unpack('<I', full_data[8:12])[0]
                    sig_len = struct.unpack('<I', full_data[12:16])[0]
                    zip_offset = 16 + pub_len + sig_len
                    zip_bytes = io.BytesIO(full_data[zip_offset:])
            elif header.startswith(b'PK\x03\x04') or ext_path.lower().endswith('.zip'):
                zip_bytes = ext_path

            if zip_bytes is not None:
                os.makedirs(target_dir, exist_ok=True)
                with zipfile.ZipFile(zip_bytes) as zf:
                    zf.extractall(target_dir)
                ext_path = target_dir
        except Exception as ex:
            print(f"[Stealth Engine] Error unpacking extension archive {ext_path}: {ex}", flush=True)
            return None

    # 2. Locate directory with manifest.json
    if os.path.isdir(ext_path):
        if os.path.exists(os.path.join(ext_path, 'manifest.json')):
            return ext_path

        for sub in ['dist', 'build', 'extension', 'src']:
            sub_path = os.path.join(ext_path, sub)
            if os.path.exists(os.path.join(sub_path, 'manifest.json')):
                return sub_path

        try:
            for item in os.listdir(ext_path):
                sub_path = os.path.join(ext_path, item)
                if os.path.isdir(sub_path) and os.path.exists(os.path.join(sub_path, 'manifest.json')):
                    return sub_path
        except Exception:
            pass

    return None


def prepare_profile_extension(profile_id, user_data_dir, webgl_vendor, webgl_renderer, cpu_cores, memory_gb, timezone_id="", width=1920, height=1080, useragent="", fingerprint_seed=None, locale="", accept_language="", webrtc="Proxy IP"):
    """
    Create a per-profile copy of the OmniShield extension with unique config.js.
    Returns the path to the per-profile extension directory.
    """
    ext_dir = os.path.join(user_data_dir, 'omnishield_ext')

    if os.path.exists(ext_dir):
        try:
            shutil.rmtree(ext_dir)
        except Exception:
            pass

    # Copy the base extension template
    shutil.copytree(EXTENSION_TEMPLATE_DIR, ext_dir)

    # Clear temporary browser cache only (never wipe user extensions or their Service Worker storage)
    default_dir = os.path.join(user_data_dir, 'Default')
    for dname in ['Cache']:
        target_cache = os.path.join(default_dir, dname)
        if os.path.exists(target_cache):
            try:
                shutil.rmtree(target_cache, ignore_errors=True)
            except Exception:
                pass

    # Compute unique seeds for this profile using fingerprint_seed if available
    seed_str = fingerprint_seed or profile_id
    seeds = compute_profile_fingerprint_seeds(seed_str)

    # Generate the per-profile config.js inside an IIFE (zero top-level variable leaks)
    config_content = f"""// OmniShield Profile Config - Auto-generated for: {profile_id}
(function() {{
  const cfg = {{
    profileId: {json.dumps(profile_id)},
    userAgent: {json.dumps(useragent)},
    width: {int(width)},
    height: {int(height)},
    canvasR: {seeds['canvasR']},
    canvasG: {seeds['canvasG']},
    canvasB: {seeds['canvasB']},
    canvasStride: {seeds['canvasStride']},
    webglVendor: {json.dumps(webgl_vendor)},
    webglRenderer: {json.dumps(webgl_renderer)},
    cpuCores: {int(cpu_cores)},
    memoryGb: {int(memory_gb)},
    audioNoise: {seeds['audioNoise']:.13f},
    timezone: {json.dumps(timezone_id)},
    locale: {json.dumps(locale)},
    acceptLanguage: {json.dumps(accept_language)},
    webrtc: {json.dumps(webrtc)},
    searchEngine: "duckduckgo"
  }};
  if (typeof self !== 'undefined' && typeof window === 'undefined') {{
    self.__OMNI_CONFIG = cfg;
  }}
  if (typeof window !== 'undefined') {{
    try {{
      Object.defineProperty(window, '__omni_tmp_cfg__', {{
        value: cfg,
        configurable: true,
        enumerable: false,
        writable: true
      }});
    }} catch (e) {{
      window.__OMNI_CONFIG = cfg;
    }}
  }}
}})();
"""

    config_path = os.path.join(ext_dir, 'config.js')
    with open(config_path, 'w', encoding='utf-8') as f:
        f.write(config_content)

    print(f"[Stealth Engine] Extension prepared for {profile_id}:", flush=True)
    print(f"  Canvas noise: R={seeds['canvasR']}, G={seeds['canvasG']}, B={seeds['canvasB']}, stride={seeds['canvasStride']}", flush=True)
    print(f"  WebGL: {webgl_vendor} / {webgl_renderer}", flush=True)
    print(f"  Hardware: {cpu_cores} cores, {memory_gb}GB RAM", flush=True)
    print(f"  Audio noise: {seeds['audioNoise']:.13f}", flush=True)
    print(f"  Timezone: {timezone_id}", flush=True)

    return ext_dir


async def apply_cdp_stealth(port, target_url, ua_str, width, height, webgl_vendor, webgl_renderer, cpu_cores, memory_gb, proxy_user="", proxy_pass="", profile_id="prof-1", timezone_id="America/New_York", fingerprint_seed=None, locale="", accept_language=""):
    """CDP fallback: Apply stealth overrides via Chrome DevTools Protocol websocket."""
    ws_url = None
    for attempt in range(30):  # 30 retries x 0.5s = 15s max wait
        try:
            res = urllib.request.urlopen(f'http://localhost:{port}/json', timeout=2)
            pages = json.loads(res.read().decode())
            page = next((p for p in pages if p.get('type') == 'page'), None)
            if page and page.get('webSocketDebuggerUrl'):
                ws_url = page.get('webSocketDebuggerUrl')
                break
        except Exception:
            pass
        await asyncio.sleep(0.5)

    if not ws_url:
        print(f"[Stealth Engine CDP] Warning: Could not connect to Chrome CDP on port {port} after 15s", flush=True)
        print(f"[Stealth Engine CDP] Extension-based injection is still active (primary method)", flush=True)
        return

    if not websockets:
        print(f"[Stealth Engine CDP] websockets module not installed, skipping secondary CDP injection. Extension-based injection is active.", flush=True)
        return

    print(f"[Stealth Engine CDP] WebSocket Connected: {ws_url}", flush=True)

    seeds = compute_profile_fingerprint_seeds(fingerprint_seed or profile_id)
    chrome_m_cdp = re.search(r'(?:Chrome|CriOS)/(\d+)\.([\d.]+)', ua_str)
    c_major = chrome_m_cdp.group(1) if chrome_m_cdp else '131'
    c_full = f"{c_major}.{chrome_m_cdp.group(2)}" if chrome_m_cdp else '131.0.6778.265'

    target_dpr = 2 if ('Macintosh' in ua_str or 'Mac OS X' in ua_str or 'iPhone' in ua_str or 'iPad' in ua_str) else 1

    user_lang = locale.strip() if (locale and locale.strip()) else "en-US"
    if accept_language and accept_language.strip():
        user_langs = [l.split(';')[0].strip() for l in accept_language.split(',') if l.strip()]
    else:
        user_langs = [user_lang, 'en']
    if user_lang not in user_langs:
        user_langs.insert(0, user_lang)

    # Build the CDP injection payload (serves as a secondary reinforcement of extension injection)
    cdp_payload = f"""
    (function() {{
      // Anti-Detection: Native Function.prototype.toString disguise (Akamai & CreepJS Spec)
      const nativeFnToString = Function.prototype.toString;
      const nativeMap = new WeakMap();

      function makeNative(fn, name, isConstructor = false) {{
        const cleanName = name || fn.name || '';
        if (name) {{
          try {{ Object.defineProperty(fn, 'name', {{ value: name, configurable: true }}); }} catch(e) {{}}
        }}
        if (isConstructor || (fn.prototype && typeof fn.prototype === 'object' && fn.prototype.constructor === fn && Object.keys(fn.prototype).length > 0)) {{
          nativeMap.set(fn, cleanName);
          return fn;
        }}
        const wrapper = {{
          [cleanName](...args) {{
            return fn.apply(this, args);
          }}
        }}[cleanName];
        try {{ Object.defineProperty(wrapper, 'length', {{ value: fn.length, configurable: true }}); }} catch(e) {{}}
        nativeMap.set(wrapper, cleanName);
        nativeMap.set(fn, cleanName);
        return wrapper;
      }}

      try {{
        const patchedToString = {{
          toString() {{
            if (typeof this !== 'function') {{
              return nativeFnToString.call(this);
            }}
            if (nativeMap.has(this)) {{
              const n = nativeMap.get(this);
              return `function ${{n}}() {{ [native code] }}`;
            }}
            return nativeFnToString.call(this);
          }}
        }}.toString;
        nativeMap.set(patchedToString, 'toString');
        Function.prototype.toString = patchedToString;
      }} catch(e) {{}}

      // Screen resolution & color depth spoofing reinforcement
      try {{
        const targetW = {int(width)};
        const targetH = {int(height)};
        function makeScreenGetter(prop, val) {{
          let g = function() {{ return val; }};
          g = makeNative(g, `get ${{prop}}`);
          return {{ get: g, configurable: true, enumerable: true }};
        }}

        const screenDescriptors = {{
          width: makeScreenGetter('width', targetW),
          height: makeScreenGetter('height', targetH),
          availWidth: makeScreenGetter('availWidth', targetW),
          availHeight: makeScreenGetter('availHeight', targetH - 40),
          colorDepth: makeScreenGetter('colorDepth', 24),
          pixelDepth: makeScreenGetter('pixelDepth', 24),
          availLeft: makeScreenGetter('availLeft', 0),
          availTop: makeScreenGetter('availTop', 0)
        }};
        if (typeof Screen !== 'undefined' && Screen.prototype) {{
          try {{ Object.defineProperties(Screen.prototype, screenDescriptors); }} catch(e) {{}}
        }}
        try {{
          let getDpr = function() {{ return {target_dpr}; }};
          getDpr = makeNative(getDpr, 'get devicePixelRatio');
          Object.defineProperty(window, 'devicePixelRatio', {{ get: getDpr, configurable: true }});

          let getOuterW = function() {{ return targetW; }};
          getOuterW = makeNative(getOuterW, 'get outerWidth');
          Object.defineProperty(window, 'outerWidth', {{ get: getOuterW, configurable: true }});

          let getOuterH = function() {{ return targetH - 40; }};
          getOuterH = makeNative(getOuterH, 'get outerHeight');
          Object.defineProperty(window, 'outerHeight', {{ get: getOuterH, configurable: true }});

          let getInnerW = function() {{ return targetW; }};
          getInnerW = makeNative(getInnerW, 'get innerWidth');
          Object.defineProperty(window, 'innerWidth', {{ get: getInnerW, configurable: true }});

          let getInnerH = function() {{ return targetH - 85; }};
          getInnerH = makeNative(getInnerH, 'get innerHeight');
          Object.defineProperty(window, 'innerHeight', {{ get: getInnerH, configurable: true }});
        }} catch(e) {{}}
      }} catch(e) {{}}

      // Screen orientation reinforcement
      try {{
        const isPortrait = {int(height)} > {int(width)};
        const orientType = isPortrait ? 'portrait-primary' : 'landscape-primary';
        const orientAngle = isPortrait ? 0 : 90;
        if (window.screen && window.screen.orientation) {{
          try {{
            Object.defineProperty(ScreenOrientation.prototype, 'type', {{ get: makeNative(() => orientType, 'get type'), configurable: true }});
            Object.defineProperty(ScreenOrientation.prototype, 'angle', {{ get: makeNative(() => orientAngle, 'get angle'), configurable: true }});
          }} catch(e) {{}}
        }}
      }} catch(e) {{}}

      // Pointer/hover media-feature reinforcement
      try {{
        const wantsTouchProfile = {json.dumps('Android' in ua_str or 'iPhone' in ua_str or 'iPad' in ua_str)};
        if (wantsTouchProfile && window.matchMedia) {{
          const origMatchMedia = window.matchMedia.bind(window);
          let patchedMM = function(query) {{
            const q = String(query).toLowerCase();
            const result = origMatchMedia(query);
            let forced = null;
            if (q.includes('pointer: coarse') || q.includes('any-pointer: coarse')) forced = true;
            else if (q.includes('pointer: fine') || q.includes('any-pointer: fine')) forced = false;
            else if (q.includes('hover: none') || q.includes('any-hover: none')) forced = true;
            else if (q.includes('hover: hover') || q.includes('any-hover: hover')) forced = false;
            if (forced === null) return result;
            try {{
              return new Proxy(result, {{
                get(target, prop) {{
                  if (prop === 'matches') return forced;
                  const val = target[prop];
                  return typeof val === 'function' ? val.bind(target) : val;
                }}
              }});
            }} catch(e) {{ return result; }}
          }};
          patchedMM = makeNative(patchedMM, 'matchMedia');
          window.matchMedia = patchedMM;
        }}
      }} catch(e) {{}}

      // Hardware & Navigator spoofing reinforcement via CDP
      try {{
        const vendor = {json.dumps(webgl_vendor)};
        const renderer = {json.dumps(webgl_renderer)};

        // Clean any own properties on navigator to ensure navigator.hasOwnProperty(p) === false
        const propsToClean = [
          'webdriver', 'platform', 'hardwareConcurrency', 'deviceMemory',
          'languages', 'userAgent', 'appVersion', 'maxTouchPoints',
          'pdfViewerEnabled', 'userAgentData', 'plugins', 'mimeTypes', 'getBattery'
        ];
        for (const p of propsToClean) {{
          try {{ if (navigator.hasOwnProperty(p)) delete navigator[p]; }} catch(e) {{}}
        }}

        // Clean automation driver globals
        const autoGlobals = [
          '__playwright', '__puppeteer_evaluation_script__',
          '$cdc_asdjflasutopfhvcZLmcfl_', '$chrome_asyncScriptInfo',
          'domAutomation', 'domAutomationController'
        ];
        for (const g of autoGlobals) {{
          try {{ if (typeof window !== 'undefined' && g in window) delete window[g]; }} catch(e) {{}}
        }}

        const isMac = {json.dumps('Macintosh' in ua_str or 'Mac OS X' in ua_str)};
        const isIOS = {json.dumps('iPhone' in ua_str or 'iPad' in ua_str)};
        const isIPad = {json.dumps('iPad' in ua_str)};
        const isAndroid = {json.dumps('Android' in ua_str)};
        const isMobileUA = {json.dumps('Mobile' in ua_str)};
        const platStr = isMac ? 'MacIntel' : (isIOS ? (isIPad ? 'iPad' : 'iPhone') : (isAndroid ? 'Linux armv8l' : 'Win32'));
        const osName = isMac ? 'macOS' : (isIOS ? 'iOS' : (isAndroid ? 'Android' : 'Windows'));
        const isMobile = isIOS || isMobileUA;
        const verStr = isMac ? '14.2.0' : (isIOS ? '17.2' : (isAndroid ? '14' : '10.0.0'));
        const archStr = (isMac ? ((vendor.includes('Apple') || renderer.includes('Apple')) ? 'arm' : 'x86') : ((isIOS || isAndroid) ? 'arm' : 'x86'));
        const modelStr = isIOS ? 'iPhone' : '';

        if (typeof Navigator !== 'undefined' && Navigator.prototype) {{
          function defProtoGetter(prop, val) {{
            let getter = function() {{ return val; }};
            getter = makeNative(getter, `get ${{prop}}`);
            try {{
              Object.defineProperty(Navigator.prototype, prop, {{
                get: getter,
                set: undefined,
                enumerable: true,
                configurable: true
              }});
            }} catch(e) {{}}
          }}

          defProtoGetter('platform', platStr);
          defProtoGetter('hardwareConcurrency', {int(cpu_cores)});
          defProtoGetter('deviceMemory', {8 if int(memory_gb) >= 8 else (4 if int(memory_gb) >= 4 else (2 if int(memory_gb) >= 2 else 1))});
          defProtoGetter('language', {json.dumps(user_lang)});
          defProtoGetter('languages', Object.freeze({json.dumps(user_langs)}));
          defProtoGetter('userAgent', {json.dumps(ua_str)});
          defProtoGetter('appVersion', {json.dumps(ua_str.replace('Mozilla/', ''))});
          defProtoGetter('maxTouchPoints', (isAndroid || isIOS) ? 5 : 0);
          defProtoGetter('pdfViewerEnabled', !(isAndroid || isIOS));

          // Native Plugins & MimeTypes (Akamai Bot Manager & CreepJS Spec)
          function buildPluginsAndMimes() {{
            if (isAndroid || isIOS) {{
              const pArr = Object.create(PluginArray.prototype);
              Object.defineProperty(pArr, 'length', {{ value: 0 }});
              pArr.item = makeNative(function() {{ return null; }}, 'item');
              pArr.namedItem = makeNative(function() {{ return null; }}, 'namedItem');
              pArr.refresh = makeNative(function() {{}}, 'refresh');
              Object.defineProperty(pArr, Symbol.toStringTag, {{ value: 'PluginArray' }});

              const mArr = Object.create(MimeTypeArray.prototype);
              Object.defineProperty(mArr, 'length', {{ value: 0 }});
              mArr.item = makeNative(function() {{ return null; }}, 'item');
              mArr.namedItem = makeNative(function() {{ return null; }}, 'namedItem');
              Object.defineProperty(mArr, Symbol.toStringTag, {{ value: 'MimeTypeArray' }});

              return {{ pluginArr: pArr, mimeArr: mArr }};
            }}

            const pluginsData = [
              {{ name: 'PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' }},
              {{ name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' }},
              {{ name: 'Chromium PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' }},
              {{ name: 'Microsoft Edge PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' }},
              {{ name: 'WebKit built-in PDF', filename: 'internal-pdf-viewer', description: 'Portable Document Format' }}
            ];

            const mimesData = [
              {{ type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' }},
              {{ type: 'text/pdf', suffixes: 'pdf', description: 'Portable Document Format' }}
            ];

            const pArr = Object.create(PluginArray.prototype);
            const mArr = Object.create(MimeTypeArray.prototype);

            const mimeObjs = mimesData.map(m => {{
              const obj = Object.create(MimeType.prototype);
              Object.defineProperty(obj, 'type', {{ value: m.type, enumerable: true, configurable: true }});
              Object.defineProperty(obj, 'suffixes', {{ value: m.suffixes, enumerable: true, configurable: true }});
              Object.defineProperty(obj, 'description', {{ value: m.description, enumerable: true, configurable: true }});
              Object.defineProperty(obj, Symbol.toStringTag, {{ value: 'MimeType' }});
              return obj;
            }});

            const pluginObjs = pluginsData.map(p => {{
              const obj = Object.create(Plugin.prototype);
              Object.defineProperty(obj, 'name', {{ value: p.name, enumerable: true, configurable: true }});
              Object.defineProperty(obj, 'filename', {{ value: p.filename, enumerable: true, configurable: true }});
              Object.defineProperty(obj, 'description', {{ value: p.description, enumerable: true, configurable: true }});
              Object.defineProperty(obj, 'length', {{ value: mimeObjs.length, enumerable: true, configurable: true }});
              Object.defineProperty(obj, Symbol.toStringTag, {{ value: 'Plugin' }});

              mimeObjs.forEach((m, mIdx) => {{
                obj[mIdx] = m;
                obj[m.type] = m;
              }});

              obj.item = makeNative(function(i) {{ return this[i] || null; }}, 'item');
              obj.namedItem = makeNative(function(name) {{ return this[name] || null; }}, 'namedItem');
              return obj;
            }});

            // Point each mimeType's enabledPlugin to the primary PDF Viewer plugin
            mimeObjs.forEach(m => {{
              Object.defineProperty(m, 'enabledPlugin', {{ value: pluginObjs[0], enumerable: true, configurable: true }});
            }});

            pluginObjs.forEach((p, idx) => {{
              pArr[idx] = p;
              pArr[p.name] = p;
            }});
            Object.defineProperty(pArr, 'length', {{ value: pluginObjs.length }});
            pArr.item = makeNative(function(i) {{ return this[i] || null; }}, 'item');
            pArr.namedItem = makeNative(function(name) {{ return this[name] || null; }}, 'namedItem');
            pArr.refresh = makeNative(function() {{}}, 'refresh');
            Object.defineProperty(pArr, Symbol.toStringTag, {{ value: 'PluginArray' }});

            mimeObjs.forEach((m, idx) => {{
              mArr[idx] = m;
              mArr[m.type] = m;
            }});
            Object.defineProperty(mArr, 'length', {{ value: mimeObjs.length }});
            mArr.item = makeNative(function(i) {{ return this[i] || null; }}, 'item');
            mArr.namedItem = makeNative(function(name) {{ return this[name] || null; }}, 'namedItem');
            Object.defineProperty(mArr, Symbol.toStringTag, {{ value: 'MimeTypeArray' }});

            return {{ pluginArr: pArr, mimeArr: mArr }};
          }}

          const {{ pluginArr, mimeArr }} = buildPluginsAndMimes();
          defProtoGetter('plugins', pluginArr);
          defProtoGetter('mimeTypes', mimeArr);

          // Native userAgentData
          if (typeof NavigatorUAData !== 'undefined') {{
            const brands = Object.freeze([
              Object.freeze({{ brand: 'Chromium', version: {json.dumps(c_major)} }}),
              Object.freeze({{ brand: 'Google Chrome', version: {json.dumps(c_major)} }}),
              Object.freeze({{ brand: 'Not_A Brand', version: '24' }})
            ]);
            const highEntropy = {{
              architecture: archStr,
              bitness: '64',
              brands: Object.freeze([
                Object.freeze({{ brand: 'Chromium', version: {json.dumps(c_full)} }}),
                Object.freeze({{ brand: 'Google Chrome', version: {json.dumps(c_full)} }}),
                Object.freeze({{ brand: 'Not_A Brand', version: '24.0.0.0' }})
              ]),
              fullVersionList: Object.freeze([
                Object.freeze({{ brand: 'Chromium', version: {json.dumps(c_full)} }}),
                Object.freeze({{ brand: 'Google Chrome', version: {json.dumps(c_full)} }}),
                Object.freeze({{ brand: 'Not_A Brand', version: '24.0.0.0' }})
              ]),
              mobile: isMobile,
              model: modelStr,
              platform: osName,
              platformVersion: verStr,
              uaFullVersion: {json.dumps(c_full)}
            }};
            const mockUAData = Object.create(NavigatorUAData.prototype);
            Object.defineProperty(mockUAData, 'brands', {{ get: makeNative(() => brands, 'get brands'), enumerable: true }});
            Object.defineProperty(mockUAData, 'mobile', {{ get: makeNative(() => isMobile, 'get mobile'), enumerable: true }});
            Object.defineProperty(mockUAData, 'platform', {{ get: makeNative(() => osName, 'get platform'), enumerable: true }});
            mockUAData.getHighEntropyValues = makeNative(async (hints = []) => {{
              const res = {{}};
              hints.forEach(h => {{ if (h in highEntropy) res[h] = highEntropy[h]; }});
              res.brands = highEntropy.brands;
              res.mobile = highEntropy.mobile;
              res.platform = highEntropy.platform;
              return res;
            }}, 'getHighEntropyValues');
            mockUAData.toJSON = makeNative(function() {{
              return {{
                brands: highEntropy.brands,
                mobile: isMobile,
                platform: osName
              }};
            }}, 'toJSON');
            Object.defineProperty(mockUAData, Symbol.toStringTag, {{ value: 'NavigatorUAData' }});

            defProtoGetter('userAgentData', mockUAData);
          }}

          // Native Battery API
          if ('getBattery' in Navigator.prototype || 'getBattery' in navigator) {{
            const mockBattery = {{
              charging: true,
              chargingTime: 0,
              dischargingTime: Infinity,
              level: 1,
              onchargingchange: null,
              onchargingtimechange: null,
              ondischargingtimechange: null,
              onlevelchange: null,
              addEventListener: makeNative(function() {{}}, 'addEventListener'),
              removeEventListener: makeNative(function() {{}}, 'removeEventListener'),
              dispatchEvent: makeNative(function() {{ return true; }}, 'dispatchEvent'),
              [Symbol.toStringTag]: 'BatteryManager'
            }};
            let getBatteryFn = function() {{ return Promise.resolve(mockBattery); }};
            getBatteryFn = makeNative(getBatteryFn, 'getBattery');
            try {{
              Object.defineProperty(Navigator.prototype, 'getBattery', {{
                value: getBatteryFn,
                writable: true,
                enumerable: true,
                configurable: true
              }});
            }} catch(e) {{}}
          }}
        }}
      }} catch(e) {{}}

      // Media Devices spoofing (Physical Microphone & HD Camera)
      try {{
        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {{
          const isMac = {json.dumps('Mac' in ua_str)};
          const micLabel = isMac ? 'MacBook Pro Microphone (Built-in)' : 'Microphone (Realtek(R) Audio)';
          const speakerLabel = isMac ? 'MacBook Pro Speakers (Built-in)' : 'Speakers (Realtek(R) Audio)';
          const camLabel = isMac ? 'FaceTime HD Camera' : 'Integrated HD Webcam (04f2:b6d9)';
          const fakeDevs = [
            {{ deviceId: 'default', kind: 'audioinput', label: micLabel, groupId: 'group-default' }},
            {{ deviceId: 'audio-in-1', kind: 'audioinput', label: micLabel, groupId: 'group-1' }},
            {{ deviceId: 'default', kind: 'audiooutput', label: speakerLabel, groupId: 'group-default' }},
            {{ deviceId: 'audio-out-1', kind: 'audiooutput', label: speakerLabel, groupId: 'group-1' }},
            {{ deviceId: 'video-in-1', kind: 'videoinput', label: camLabel, groupId: 'group-cam' }}
          ];
          let patchedEnumerate = async function() {{
            return fakeDevs.map(d => Object.assign(Object.create(window.MediaDeviceInfo ? window.MediaDeviceInfo.prototype : Object.prototype), d));
          }};
          patchedEnumerate = makeNative(patchedEnumerate, 'enumerateDevices');
          navigator.mediaDevices.enumerateDevices = patchedEnumerate;
        }}
      }} catch(e) {{}}

      // WebGL spoofing reinforcement
      try {{
        const vendor = {json.dumps(webgl_vendor)};
        const renderer = {json.dumps(webgl_renderer)};
        const isApple = vendor.includes('Apple') || renderer.includes('Apple');
        const isMobileGPU = {json.dumps('Android' in ua_str or 'iPhone' in ua_str or 'iPad' in ua_str)};
        const getParam = WebGLRenderingContext.prototype.getParameter;
        let patchedGetParam = function(param) {{
          const res = getParam.apply(this, arguments);
          if (param === 37445) return vendor;
          if (param === 37446) return renderer;
          return res;
        }};
        patchedGetParam = makeNative(patchedGetParam, 'getParameter');
        WebGLRenderingContext.prototype.getParameter = patchedGetParam;

        if (window.WebGL2RenderingContext) {{
          const getParam2 = WebGL2RenderingContext.prototype.getParameter;
          let patchedGetParam2 = function(param) {{
            const res = getParam2.apply(this, arguments);
            if (param === 37445) return vendor;
            if (param === 37446) return renderer;
            return res;
          }};
          patchedGetParam2 = makeNative(patchedGetParam2, 'getParameter');
          WebGL2RenderingContext.prototype.getParameter = patchedGetParam2;
        }}

        const DESKTOP_ONLY_EXT = ['WEBGL_compressed_texture_s3tc', 'WEBGL_compressed_texture_s3tc_srgb', 'EXT_texture_compression_bptc', 'EXT_texture_compression_rgtc'];
        const MOBILE_ONLY_EXT = ['WEBGL_compressed_texture_etc', 'WEBGL_compressed_texture_etc1', 'WEBGL_compressed_texture_astc', 'WEBGL_compressed_texture_pvrtc'];

        const patchExtensions = (proto) => {{
          const origGetSupported = proto.getSupportedExtensions;
          const origGetExtension = proto.getExtension;
          if (origGetSupported) {{
            let patchedGetSupported = function () {{
              let list = origGetSupported.apply(this, arguments) || [];
              list = isMobileGPU
                ? list.filter((e) => !DESKTOP_ONLY_EXT.includes(e))
                : list.filter((e) => !MOBILE_ONLY_EXT.includes(e));
              return list;
            }};
            patchedGetSupported = makeNative(patchedGetSupported, 'getSupportedExtensions');
            proto.getSupportedExtensions = patchedGetSupported;
          }}
          if (origGetExtension) {{
            let patchedGetExtension = function (name) {{
              if (isMobileGPU && DESKTOP_ONLY_EXT.includes(name)) return null;
              if (!isMobileGPU && MOBILE_ONLY_EXT.includes(name)) return null;
              return origGetExtension.apply(this, arguments);
            }};
            patchedGetExtension = makeNative(patchedGetExtension, 'getExtension');
            proto.getExtension = patchedGetExtension;
          }}
        }};
        patchExtensions(WebGLRenderingContext.prototype);
        if (window.WebGL2RenderingContext) patchExtensions(WebGL2RenderingContext.prototype);
      }} catch(e) {{}}

      // Canvas 2D & Iframe stealth noise (defeats iframe canvas bypass on BrowserLeaks, CreepJS)
      try {{
        const rShift = {seeds['canvasR']};
        const gShift = {seeds['canvasG']};
        const bShift = {seeds['canvasB']};
        const pixelStride = {seeds['canvasStride']};

        function applyPixelNoise(data) {{
          if (!data || !data.length) return;
          const step = Math.max(4, pixelStride * 4);
          const rDelta = {seeds['canvasR']};
          const gDelta = {seeds['canvasG']};
          const bDelta = {seeds['canvasB']};
          for (let i = 0; i < data.length; i += step) {{
            if (data[i + 3] > 0) {{
              data[i]     = Math.max(0, Math.min(255, data[i]     + rDelta));
              data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + gDelta));
              data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + bDelta));
            }}
          }}
        }}

        // WebGL readPixels hook
        const origReadPixels = WebGLRenderingContext.prototype.readPixels;
        let patchedReadPixels = function() {{
          const res = origReadPixels.apply(this, arguments);
          try {{
            const pixels = arguments[6];
            if (pixels && pixels.length) applyPixelNoise(pixels);
          }} catch(e) {{}}
          return res;
        }};
        patchedReadPixels = makeNative(patchedReadPixels, 'readPixels');
        WebGLRenderingContext.prototype.readPixels = patchedReadPixels;
        if (window.WebGL2RenderingContext) {{
          WebGL2RenderingContext.prototype.readPixels = patchedReadPixels;
        }}

        const hookedWins = new WeakSet();

        function hookCanvasWindow(targetWin) {{
          if (!targetWin || typeof targetWin !== 'object' || hookedWins.has(targetWin)) return;
          try {{ hookedWins.add(targetWin); }} catch(e) {{}}
          try {{
            if (!targetWin.HTMLCanvasElement || !targetWin.CanvasRenderingContext2D) return;
            const origToDataURL = targetWin.HTMLCanvasElement.prototype.toDataURL;
            const origGetImageData = targetWin.CanvasRenderingContext2D.prototype.getImageData;
            const origToBlob = targetWin.HTMLCanvasElement.prototype.toBlob;

            const canvasContextMap = new WeakMap();
            if (targetWin.HTMLCanvasElement.prototype.getContext) {{
              const origGetCtx = targetWin.HTMLCanvasElement.prototype.getContext;
              let patchedGetCtx = function(type) {{
                const res = origGetCtx.apply(this, arguments);
                if (res && typeof type === 'string') {{
                  canvasContextMap.set(this, type.toLowerCase());
                }}
                return res;
              }};
              patchedGetCtx = makeNative(patchedGetCtx, 'getContext');
              targetWin.HTMLCanvasElement.prototype.getContext = patchedGetCtx;
            }}

            function isFingerprintCanvas(canvas, w, h) {{
              if (!canvas) return true;
              try {{
                const id = (canvas.id || '').toLowerCase();
                const cls = (canvas.className || '').toLowerCase();
                if (id.includes('captcha') || cls.includes('captcha') || id.includes('cimage') || id.includes('captcha-img')) {{
                  return false;
                }}
                if (canvas.isConnected) {{
                  return false;
                }}
              }} catch (e) {{}}
              return true;
            }}

            let patchedToDataURL = function() {{
              if (!isFingerprintCanvas(this, this.width, this.height)) {{
                return origToDataURL.apply(this, arguments);
              }}
              try {{
                const ctxType = canvasContextMap.get(this);
                if (this.width >= 16 && this.height >= 16) {{
                  if (ctxType === '2d') {{
                    const ctx = this.getContext('2d');
                    if (ctx) {{
                      const imgData = origGetImageData.call(ctx, 0, 0, this.width, this.height);
                      if (imgData && imgData.data) {{
                        applyPixelNoise(imgData.data);
                        ctx.putImageData(imgData, 0, 0);
                      }}
                    }}
                  }} else if (ctxType && ctxType.includes('webgl')) {{
                    const off = targetWin.document.createElement('canvas');
                    off.width = this.width;
                    off.height = this.height;
                    const offCtx = off.getContext('2d');
                    offCtx.drawImage(this, 0, 0);
                    const imgData = origGetImageData.call(offCtx, 0, 0, this.width, this.height);
                    if (imgData && imgData.data) {{
                      applyPixelNoise(imgData.data);
                      offCtx.putImageData(imgData, 0, 0);
                      return origToDataURL.apply(off, arguments);
                    }}
                  }}
                }}
              }} catch (err) {{}}
              return origToDataURL.apply(this, arguments);
            }};
            patchedToDataURL = makeNative(patchedToDataURL, 'toDataURL');
            targetWin.HTMLCanvasElement.prototype.toDataURL = patchedToDataURL;

            let patchedGetImageData = function(x, y, w, h) {{
              const res = origGetImageData.apply(this, arguments);
              const canvasEl = this.canvas;
              if (!isFingerprintCanvas(canvasEl, w, h)) {{
                return res;
              }}
              try {{
                if (res && res.data && w >= 16 && h >= 16) applyPixelNoise(res.data);
              }} catch (e) {{}}
              return res;
            }};
            patchedGetImageData = makeNative(patchedGetImageData, 'getImageData');
            targetWin.CanvasRenderingContext2D.prototype.getImageData = patchedGetImageData;

            let patchedToBlob = function(callback, type, quality) {{
              if (!isFingerprintCanvas(this, this.width, this.height)) {{
                return origToBlob.call(this, callback, type, quality);
              }}
              try {{
                const ctxType = canvasContextMap.get(this);
                if (this.width >= 16 && this.height >= 16) {{
                  if (ctxType === '2d') {{
                    const ctx = this.getContext('2d');
                    if (ctx) {{
                      const imgData = origGetImageData.call(ctx, 0, 0, this.width, this.height);
                      if (imgData && imgData.data) {{
                        applyPixelNoise(imgData.data);
                        ctx.putImageData(imgData, 0, 0);
                      }}
                    }}
                  }} else if (ctxType && ctxType.includes('webgl')) {{
                    const off = targetWin.document.createElement('canvas');
                    off.width = this.width;
                    off.height = this.height;
                    const offCtx = off.getContext('2d');
                    offCtx.drawImage(this, 0, 0);
                    const imgData = origGetImageData.call(offCtx, 0, 0, this.width, this.height);
                    if (imgData && imgData.data) {{
                      applyPixelNoise(imgData.data);
                      offCtx.putImageData(imgData, 0, 0);
                      return origToBlob.call(off, callback, type, quality);
                    }}
                  }}
                }}
              }} catch (err) {{}}
              return origToBlob.call(this, callback, type, quality);
            }};
            patchedToBlob = makeNative(patchedToBlob, 'toBlob');
            targetWin.HTMLCanvasElement.prototype.toBlob = patchedToBlob;

            // OffscreenCanvas & OffscreenCanvasRenderingContext2D Hooking
            if (targetWin.OffscreenCanvas && targetWin.OffscreenCanvas.prototype.convertToBlob) {{
              const origConvertToBlob = targetWin.OffscreenCanvas.prototype.convertToBlob;
              let patchedConvertToBlob = async function(options) {{
                try {{
                  if (this.width >= 16 && this.height >= 16) {{
                    const ctxType = canvasContextMap.get(this);
                    if (ctxType === '2d') {{
                      const ctx = this.getContext('2d');
                      if (ctx && targetWin.OffscreenCanvasRenderingContext2D) {{
                        const imgData = targetWin.OffscreenCanvasRenderingContext2D.prototype.getImageData.call(ctx, 0, 0, this.width, this.height);
                        if (imgData && imgData.data) {{
                          applyPixelNoise(imgData.data);
                          ctx.putImageData(imgData, 0, 0);
                        }}
                      }}
                    }} else if (ctxType && ctxType.includes('webgl')) {{
                      const off = new targetWin.OffscreenCanvas(this.width, this.height);
                      const offCtx = off.getContext('2d');
                      offCtx.drawImage(this, 0, 0);
                      const imgData = offCtx.getImageData(0, 0, this.width, this.height);
                      if (imgData && imgData.data) {{
                        applyPixelNoise(imgData.data);
                        offCtx.putImageData(imgData, 0, 0);
                        return origConvertToBlob.call(off, options);
                      }}
                    }}
                  }}
                }} catch(e) {{}}
                return origConvertToBlob.apply(this, arguments);
              }};
              patchedConvertToBlob = makeNative(patchedConvertToBlob, 'convertToBlob');
              targetWin.OffscreenCanvas.prototype.convertToBlob = patchedConvertToBlob;
            }}

            if (targetWin.OffscreenCanvasRenderingContext2D && targetWin.OffscreenCanvasRenderingContext2D.prototype.getImageData) {{
              const origOffGetImageData = targetWin.OffscreenCanvasRenderingContext2D.prototype.getImageData;
              let patchedOffGetImageData = function(x, y, w, h) {{
                const res = origOffGetImageData.apply(this, arguments);
                try {{
                  if (res && res.data && w >= 16 && h >= 16) applyPixelNoise(res.data);
                }} catch(e) {{}}
                return res;
              }};
              patchedOffGetImageData = makeNative(patchedOffGetImageData, 'getImageData');
              targetWin.OffscreenCanvasRenderingContext2D.prototype.getImageData = patchedOffGetImageData;
            }}
          }} catch (e) {{}}
        }}

        hookCanvasWindow(window);

        try {{
          const descWin = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow');
          const descDoc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentDocument');

          if (descWin && descWin.get) {{
            const origWinGet = descWin.get;
            let patchedWinGet = function() {{
              const w = origWinGet.call(this);
              if (w) hookCanvasWindow(w);
              return w;
            }};
            patchedWinGet = makeNative(patchedWinGet, 'get contentWindow');
            Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {{
              get: patchedWinGet,
              configurable: true,
              enumerable: true
            }});
          }}

          if (descDoc && descDoc.get) {{
            const origDocGet = descDoc.get;
            let patchedDocGet = function() {{
              const d = origDocGet.call(this);
              if (d && d.defaultView) hookCanvasWindow(d.defaultView);
              return d;
            }};
            patchedDocGet = makeNative(patchedDocGet, 'get contentDocument');
            Object.defineProperty(HTMLIFrameElement.prototype, 'contentDocument', {{
              get: patchedDocGet,
              configurable: true,
              enumerable: true
            }});
          }}
        }} catch (e) {{}}

        // Document focus & visibility alignment (prototype-only to prevent ownProperty detection)
        try {{
          if (typeof Document !== 'undefined' && Document.prototype) {{
            if (Document.prototype.hasFocus) {{
              Document.prototype.hasFocus = makeNative(function() {{ return true; }}, 'hasFocus');
            }}
            if ('hidden' in Document.prototype) {{
              Object.defineProperty(Document.prototype, 'hidden', {{
                get: makeNative(function() {{ return false; }}, 'get hidden'),
                configurable: true,
                enumerable: true
              }});
            }}
            if ('visibilityState' in Document.prototype) {{
              Object.defineProperty(Document.prototype, 'visibilityState', {{
                get: makeNative(function() {{ return 'visible'; }}, 'get visibilityState'),
                configurable: true,
                enumerable: true
              }});
            }}
          }}
          if (typeof document !== 'undefined') {{
            if (document.hasOwnProperty('hasFocus')) delete document.hasFocus;
            if (document.hasOwnProperty('hidden')) delete document.hidden;
            if (document.hasOwnProperty('visibilityState')) delete document.visibilityState;
          }}
        }} catch(e) {{}}

        // Event isTrusted & Synthetic Event Disguise (Akamai Heuristic Defense)
        try {{
          if (typeof EventTarget !== 'undefined' && EventTarget.prototype.dispatchEvent) {{
            const origDispatch = EventTarget.prototype.dispatchEvent;
            let patchedDispatch = function(event) {{
              if (event && !event.isTrusted) {{
                try {{
                  Object.defineProperty(event, 'isTrusted', {{ value: true, configurable: true }});
                }} catch(e) {{}}
              }}
              return origDispatch.apply(this, arguments);
            }};
            patchedDispatch = makeNative(patchedDispatch, 'dispatchEvent');
            EventTarget.prototype.dispatchEvent = patchedDispatch;
          }}
        }} catch(e) {{}}

        // Permissions API alignment on Permissions.prototype
        if (window.Permissions && window.Permissions.prototype && window.Permissions.prototype.query) {{
          try {{
            const origPermQuery = window.Permissions.prototype.query;
            let patchedPermQuery = function(parameters) {{
              if (parameters && parameters.name === 'notifications') {{
                const notifPerm = (window.Notification && window.Notification.permission) || 'default';
                const notifState = (notifPerm === 'granted') ? 'granted' : ((notifPerm === 'denied') ? 'denied' : 'prompt');
                const mockStatus = {{
                  state: notifState,
                  name: 'notifications',
                  onchange: null,
                  addEventListener: makeNative(function() {{}}, 'addEventListener'),
                  removeEventListener: makeNative(function() {{}}, 'removeEventListener'),
                  dispatchEvent: makeNative(function() {{ return true; }}, 'dispatchEvent'),
                  [Symbol.toStringTag]: 'PermissionStatus'
                }};
                if (window.PermissionStatus && window.PermissionStatus.prototype) {{
                  Object.setPrototypeOf(mockStatus, window.PermissionStatus.prototype);
                }}
                return Promise.resolve(mockStatus);
              }}
              return origPermQuery.apply(this, arguments);
            }};
            patchedPermQuery = makeNative(patchedPermQuery, 'query');
            window.Permissions.prototype.query = patchedPermQuery;
            if (navigator.permissions && navigator.permissions.hasOwnProperty('query')) {{
              delete navigator.permissions.query;
            }}
          }} catch (e) {{}}
        }}

        // Notification permission alignment (non-enumerable matching native V8)
        try {{
          if (typeof window !== 'undefined' && window.Notification) {{
            let getNotifPerm = function() {{ return 'default'; }};
            getNotifPerm = makeNative(getNotifPerm, 'get permission');
            Object.defineProperty(window.Notification, 'permission', {{
              get: getNotifPerm,
              configurable: true,
              enumerable: false
            }});

            if (window.Notification.requestPermission) {{
              let patchedReqPerm = function(callback) {{
                const res = Promise.resolve('default');
                if (typeof callback === 'function') {{
                  try {{ callback('default'); }} catch(e) {{}}
                }}
                return res;
              }};
              patchedReqPerm = makeNative(patchedReqPerm, 'requestPermission');
              window.Notification.requestPermission = patchedReqPerm;
            }}
          }}
        }} catch(e) {{}}

        // Comprehensive Intl timezone and locale synchronization
        try {{
          const targetLoc = {json.dumps(user_lang)};
          const targetTz = {json.dumps(timezone_id)};

          const intlConstructors = [
            Intl.DateTimeFormat,
            Intl.NumberFormat,
            Intl.Collator,
            Intl.PluralRules,
            Intl.RelativeTimeFormat,
            Intl.ListFormat,
            Intl.Segmenter,
            Intl.DisplayNames
          ].filter(Boolean);

          for (const ctor of intlConstructors) {{
            if (ctor && ctor.prototype && ctor.prototype.resolvedOptions) {{
              const origRes = ctor.prototype.resolvedOptions;
              let patchedRes = function() {{
                const r = origRes.apply(this, arguments);
                if (r) {{
                  if (targetLoc && targetLoc.trim()) r.locale = targetLoc.trim();
                  if (ctor === Intl.DateTimeFormat && targetTz && targetTz.trim()) r.timeZone = targetTz.trim();
                }}
                return r;
              }};
              patchedRes = makeNative(patchedRes, 'resolvedOptions');
              ctor.prototype.resolvedOptions = patchedRes;
            }}
          }}
        }} catch(e) {{}}

        // Date timezone math
        if ({json.dumps(timezone_id)} && {json.dumps(timezone_id)}.trim()) {{
          try {{
            const targetTz = {json.dumps(timezone_id)}.trim();
            const origGetTimezoneOffset = Date.prototype.getTimezoneOffset;
            let patchedGetTimezoneOffset = function() {{
              try {{
                const utc = new Date(this.toLocaleString('en-US', {{ timeZone: 'UTC' }}));
                const target = new Date(this.toLocaleString('en-US', {{ timeZone: targetTz }}));
                const diff = Math.round((utc - target) / 60000);
                if (!isNaN(diff)) return diff;
              }} catch(e) {{}}
              return origGetTimezoneOffset.apply(this, arguments);
            }};
            patchedGetTimezoneOffset = makeNative(patchedGetTimezoneOffset, 'getTimezoneOffset');
            Date.prototype.getTimezoneOffset = patchedGetTimezoneOffset;
          }} catch(e) {{}}
        }}

        // WebGPU Adapter & Architecture spoofing
        try {{
          if (navigator.gpu && navigator.gpu.requestAdapter) {{
            const origRequestAdapter = navigator.gpu.requestAdapter;
            let patchedRequestAdapter = async function(options) {{
              const adapter = await origRequestAdapter.apply(this, arguments);
              if (!adapter) return adapter;

              const fakeInfo = {{
                vendor: {json.dumps(webgl_vendor)}.toLowerCase().includes('nvidia') ? 'nvidia' : ({json.dumps(webgl_vendor)}.toLowerCase().includes('apple') ? 'apple' : ({json.dumps(webgl_vendor)}.toLowerCase().includes('intel') ? 'intel' : 'google')),
                architecture: archStr === 'arm' ? 'arm64' : 'x86_64',
                device: {json.dumps(webgl_renderer)},
                description: {json.dumps(webgl_renderer)},
                [Symbol.toStringTag]: 'GPUAdapterInfo'
              }};

              if (window.GPUAdapterInfo && window.GPUAdapterInfo.prototype) {{
                Object.setPrototypeOf(fakeInfo, window.GPUAdapterInfo.prototype);
              }}

              if (window.GPUAdapter && window.GPUAdapter.prototype) {{
                if (window.GPUAdapter.prototype.requestAdapterInfo) {{
                  let patchedReqInfo = async function() {{ return fakeInfo; }};
                  patchedReqInfo = makeNative(patchedReqInfo, 'requestAdapterInfo');
                  window.GPUAdapter.prototype.requestAdapterInfo = patchedReqInfo;
                }}
                if ('info' in window.GPUAdapter.prototype) {{
                  try {{
                    let getInfo = function() {{ return fakeInfo; }};
                    getInfo = makeNative(getInfo, 'get info');
                    Object.defineProperty(window.GPUAdapter.prototype, 'info', {{
                      get: getInfo,
                      configurable: true,
                      enumerable: true
                    }});
                  }} catch(e) {{}}
                }}
              }}
              return adapter;
            }};
            patchedRequestAdapter = makeNative(patchedRequestAdapter, 'requestAdapter');
            navigator.gpu.requestAdapter = patchedRequestAdapter;
          }}
        }} catch(e) {{}}

        // window.chrome object integrity disguise
        try {{
          if (typeof window !== 'undefined') {{
            if (!window.chrome) window.chrome = {{}};
            if (!window.chrome.app) {{
              window.chrome.app = {{
                isInstalled: false,
                InstallState: {{ DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' }},
                RunningState: {{ CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' }},
                getIsInstalled: makeNative(function() {{ return false; }}, 'getIsInstalled'),
                getDetails: makeNative(function() {{ return null; }}, 'getDetails'),
                installState: makeNative(function() {{}}, 'installState')
              }};
            }}
            if (!window.chrome.csi) {{
              let csiFn = function() {{
                return {{
                  startE: Math.floor(performance.timeOrigin || (performance.timing ? performance.timing.navigationStart : Date.now())),
                  onloadT: Math.floor((performance.timing ? performance.timing.loadEventEnd : Date.now())),
                  pageT: (performance.now ? performance.now() : 0),
                  tran: 15
                }};
              }};
              csiFn = makeNative(csiFn, 'csi');
              window.chrome.csi = csiFn;
            }}
            if (!window.chrome.loadTimes) {{
              let loadTimesFn = function() {{
                const t = performance.timing || {{}};
                const origin = performance.timeOrigin || t.navigationStart || Date.now();
                return {{
                  requestTime: origin / 1000,
                  startLoadTime: origin / 1000,
                  commitLoadTime: (origin + 45) / 1000,
                  finishDocumentLoadTime: (origin + 120) / 1000,
                  finishLoadTime: (origin + 180) / 1000,
                  firstPaintTime: (origin + 70) / 1000,
                  firstPaintAfterLoadTime: 0,
                  navigationType: 'Other',
                  wasFetchedViaSpdy: true,
                  wasNpnNegotiated: true,
                  npnNegotiatedProtocol: 'h2',
                  wasAlternateProtocolAvailable: false,
                  connectionInfo: 'h2'
                }};
              }};
              loadTimesFn = makeNative(loadTimesFn, 'loadTimes');
              window.chrome.loadTimes = loadTimesFn;
            }}
          }}
        }} catch(e) {{}}

        // Error call-stack leak sanitization
        try {{
          const descStack = Object.getOwnPropertyDescriptor(Error.prototype, 'stack');
          if (descStack && descStack.get) {{
            const origStackGet = descStack.get;
            let patchedStackGet = function() {{
              const s = origStackGet.call(this);
              if (typeof s === 'string') {{
                return s.split('\\n').filter(l => !l.includes('inject.js') && !l.includes('config.js')).join('\\n');
              }}
              return s;
            }};
            patchedStackGet = makeNative(patchedStackGet, 'get stack');
            Object.defineProperty(Error.prototype, 'stack', {{
              get: patchedStackGet,
              set: descStack.set,
              configurable: true
            }});
          }}
        }} catch(e) {{}}

        // Performance timeline sanitizer
        try {{
          if (typeof Performance !== 'undefined' && Performance.prototype) {{
            function sanitizePerf(entries) {{
              if (!entries || !entries.length) return entries;
              return entries.filter(e => {{
                const n = (e && e.name) ? String(e.name) : '';
                return !n.includes('inject.js') && !n.includes('config.js');
              }});
            }}
            if (Performance.prototype.getEntries) {{
              const origGet = Performance.prototype.getEntries;
              let pGet = function() {{ return sanitizePerf(origGet.apply(this, arguments)); }};
              pGet = makeNative(pGet, 'getEntries');
              Performance.prototype.getEntries = pGet;
            }}
            if (Performance.prototype.getEntriesByType) {{
              const origGetT = Performance.prototype.getEntriesByType;
              let pGetT = function(type) {{ return sanitizePerf(origGetT.apply(this, arguments)); }};
              pGetT = makeNative(pGetT, 'getEntriesByType');
              Performance.prototype.getEntriesByType = pGetT;
            }}
            if (Performance.prototype.getEntriesByName) {{
              const origGetN = Performance.prototype.getEntriesByName;
              let pGetN = function(name, type) {{
                if (typeof name === 'string' && (name.includes('inject.js') || name.includes('config.js'))) return [];
                return sanitizePerf(origGetN.apply(this, arguments));
              }};
              pGetN = makeNative(pGetN, 'getEntriesByName');
              Performance.prototype.getEntriesByName = pGetN;
            }}
          }}
        }} catch(e) {{}}

        // NetworkInformation API
        try {{
          if (!isIOS) {{
            const netInfo = {{
              downlink: 10,
              effectiveType: '4g',
              rtt: 50,
              saveData: false,
              onchange: null,
              addEventListener: makeNative(function() {{}}, 'addEventListener'),
              removeEventListener: makeNative(function() {{}}, 'removeEventListener'),
              dispatchEvent: makeNative(function() {{ return true; }}, 'dispatchEvent'),
              [Symbol.toStringTag]: 'NetworkInformation'
            }};
            if (window.NetworkInformation && window.NetworkInformation.prototype) {{
              Object.setPrototypeOf(netInfo, window.NetworkInformation.prototype);
              const defNetGetter = (p, v) => {{
                let g = function() {{ return v; }};
                g = makeNative(g, `get ${{p}}`);
                try {{
                  Object.defineProperty(window.NetworkInformation.prototype, p, {{
                    get: g,
                    configurable: true,
                    enumerable: true
                  }});
                }} catch(e) {{}}
              }};
              defNetGetter('downlink', 10);
              defNetGetter('effectiveType', '4g');
              defNetGetter('rtt', 50);
              defNetGetter('saveData', false);
            }}
            if (window.Navigator && window.Navigator.prototype) {{
              let getConn = function() {{ return netInfo; }};
              getConn = makeNative(getConn, 'get connection');
              Object.defineProperty(window.Navigator.prototype, 'connection', {{
                get: getConn,
                configurable: true,
                enumerable: true
              }});
            }}
            if (navigator.hasOwnProperty('connection')) {{
              delete navigator.connection;
            }}
          }}
        }} catch(e) {{}}
      }} catch(e) {{}}
    }})();
    """

    try:
        async with websockets.connect(ws_url, close_timeout=5) as ws:
            # 1. Enable Page Agent
            await ws.send(json.dumps({"id": 1, "method": "Page.enable"}))
            await ws.recv()

            # 2. Inject CDP reinforcement script for future navigations
            await ws.send(json.dumps({
                "id": 2,
                "method": "Page.addScriptToEvaluateOnNewDocument",
                "params": { "source": cdp_payload, "runImmediately": True }
            }))
            await ws.recv()

            # 4. User-Agent & Client Hints Override
            is_mac = 'Macintosh' in ua_str or 'Mac OS X' in ua_str
            is_ios = 'iPhone' in ua_str or 'iPad' in ua_str
            is_android = 'Android' in ua_str
            is_mobile_ua = 'Mobile' in ua_str

            if is_mac:
                os_platform, platform_version, cdp_platform, arch, model = 'macOS', '14.2.0', 'MacIntel', 'x86', ''
            elif is_ios:
                os_platform, platform_version, cdp_platform, arch, model = 'iOS', '17.2', 'iPhone', 'arm', 'iPhone'
            elif is_android:
                ver_match = re.search(r'Android ([\d.]+)', ua_str)
                model_match = re.search(r'Android [\d.]+;\s*([^;)]+)\)', ua_str)
                os_platform = 'Android'
                platform_version = ver_match.group(1) if ver_match else '10'
                model = model_match.group(1).strip() if model_match else ''
                cdp_platform, arch = 'Linux armv8l', 'arm'
            else:
                os_platform, platform_version, cdp_platform, arch, model = 'Windows', '10.0.0', 'Win32', 'x86', ''

            is_mobile = is_ios or is_mobile_ua

            chrome_m = re.search(r'(?:Chrome|CriOS)/(\d+)\.([\d.]+)', ua_str)
            chrome_major = chrome_m.group(1) if chrome_m else '150'
            chrome_full = f"{chrome_major}.{chrome_m.group(2)}" if chrome_m else '150.0.0.0'

            eff_accept_lang = accept_language.strip() if (accept_language and accept_language.strip()) else ("en-US,en;q=0.9" if not locale else f"{locale},en;q=0.9")
            # Build unified UA & Client Hints payload
            ua_override_params = {
                "userAgent": ua_str,
                "acceptLanguage": eff_accept_lang,
                "platform": cdp_platform,
                "userAgentMetadata": {
                    "brands": [
                        {"brand": "Chromium", "version": chrome_major},
                        {"brand": "Google Chrome", "version": chrome_major},
                        {"brand": "Not_A Brand", "version": "24"}
                    ],
                    "fullVersionList": [
                        {"brand": "Chromium", "version": chrome_full},
                        {"brand": "Google Chrome", "version": chrome_full},
                        {"brand": "Not_A Brand", "version": "24.0.0.0"}
                    ],
                    "fullVersion": chrome_full,
                    "platform": os_platform,
                    "platformVersion": platform_version,
                    "architecture": arch,
                    "model": model,
                    "mobile": is_mobile,
                    "bitness": "64"
                }
            }

            # Apply Network-level override (forces native HTTP Sec-CH-UA-Platform headers over the wire)
            try:
                await ws.send(json.dumps({"id": 30, "method": "Network.enable"}))
                await ws.recv()
                await ws.send(json.dumps({
                    "id": 31,
                    "method": "Network.setUserAgentOverride",
                    "params": ua_override_params
                }))
                await ws.recv()
            except Exception:
                pass

            # Apply DOM-level Emulation override
            await ws.send(json.dumps({
                "id": 3,
                "method": "Emulation.setUserAgentOverride",
                "params": ua_override_params
            }))
            await ws.recv()

            # 5. Device metrics override (width, height, screenWidth, screenHeight, mobile flag)
            await ws.send(json.dumps({
                "id": 4,
                "method": "Emulation.setDeviceMetricsOverride",
                "params": {
                    "width": width,
                    "height": height,
                    "deviceScaleFactor": 2 if (is_mac or is_ios) else 1,
                    "mobile": is_mobile,
                    "screenWidth": width,
                    "screenHeight": height,
                    "positionX": 0,
                    "positionY": 0,
                    "dontSetVisibleSize": True
                }
            }))
            await ws.recv()

            # 5b. Touch & Pointer Emulation (for mobile/tablet profiles)
            if is_mobile or is_android or is_ios:
                try:
                    await ws.send(json.dumps({
                        "id": 90,
                        "method": "Emulation.setTouchEmulationEnabled",
                        "params": { "enabled": True, "maxTouchPoints": 5 }
                    }))
                    await ws.recv()
                    await ws.send(json.dumps({
                        "id": 91,
                        "method": "Emulation.setEmitTouchEventsForMouse",
                        "params": { "enabled": True, "configuration": "mobile" }
                    }))
                    await ws.recv()
                except Exception:
                    pass

            # 5c. Timezone Override via CDP (normalizes Asia/Calcutta to Asia/Kolkata if provided)
            if timezone_id and timezone_id.strip():
                eff_tz = timezone_id.strip()
                if eff_tz == 'Asia/Calcutta':
                    eff_tz = 'Asia/Kolkata'
                await ws.send(json.dumps({
                    "id": 8,
                    "method": "Emulation.setTimezoneOverride",
                    "params": { "timezoneId": eff_tz }
                }))
                await ws.recv()

            # 6. Page navigation handled natively on launch (preventing duplicate request/refresh token invalidation)

            # 7. Bring window to front desktop focus
            try:
                await ws.send(json.dumps({
                    "id": 99,
                    "method": "Page.bringToFront"
                }))
                await ws.recv()
            except Exception:
                pass

            print(f"[Stealth Engine CDP] Overrides applied successfully! ({webgl_vendor} / {webgl_renderer} / TZ={eff_tz})", flush=True)

    except Exception as e:
        print(f"[Stealth Engine CDP] Warning: {e}", flush=True)
        print(f"[Stealth Engine CDP] Extension-based injection is still active (primary method)", flush=True)


def sanitize_user_agent(ua, os_hint=""):
    """
    Ensures User-Agent uses modern Chromium/CriOS syntax matching the portable engine.
    """
    if not ua:
        return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36"

    import re
    # Upgrade any older Chrome/CriOS versions to match the installed Chromium 150 engine (standard reduced UA format)
    ua = re.sub(r'Chrome/(?:12[0-9]|13[0-9]|14[0-9]|15[0-9])\.[\d.]+', 'Chrome/150.0.0.0', ua)
    ua = re.sub(r'CriOS/(?:12[0-9]|13[0-9]|14[0-9]|15[0-9])\.[\d.]+', 'CriOS/150.0.0.0', ua)

    if "Version/" in ua and "Safari/" in ua and "Chrome/" not in ua and "CriOS/" not in ua:
        if "iPhone" in ua or "iPad" in ua or "iOS" in os_hint or "iPhone" in os_hint or "iPad" in os_hint:
            ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/537.36 (KHTML, like Gecko) CriOS/150.0.0.0 Mobile/15E148 Safari/537.36"
        else:
            ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36"

    return ua


def launch_stealth_profile(profile_id, name, width, height, useragent, proxy_str, port=9222, url="about:blank", webgl_vendor="Google Inc. (NVIDIA)", webgl_renderer="ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0)", cpu_cores=8, memory_gb=16, proxy_user="", proxy_pass="", timezone_id="America/New_York", custom_extensions=None, fingerprint_seed=None, locale="", accept_language="", webrtc="Proxy IP"):
    useragent = sanitize_user_agent(useragent, name)
    print(f"[Stealth Engine] launch_stealth_profile called for: {name} (proxy={bool(proxy_str)}, tz={timezone_id}, seed={fingerprint_seed})", flush=True)

    safe_name = "".join(c if c.isalnum() else "_" for c in name).lower()
    user_data_dir = os.path.join(PROFILES_DIR, f"{profile_id}_{safe_name}")
    os.makedirs(user_data_dir, exist_ok=True)

    # Clean up old Singleton lockfiles if leftover from previous crashed Chrome instance
    for s_file in ['SingletonLock', 'SingletonCookie', 'SingletonSocket']:
        lockfile = os.path.join(user_data_dir, s_file)
        if os.path.exists(lockfile) or os.path.islink(lockfile):
            try:
                os.remove(lockfile)
            except Exception:
                pass

    # Prepare per-profile extension with unique fingerprint config
    ext_dir = prepare_profile_extension(
        profile_id=profile_id,
        user_data_dir=user_data_dir,
        webgl_vendor=webgl_vendor,
        webgl_renderer=webgl_renderer,
        cpu_cores=cpu_cores,
        memory_gb=memory_gb,
        timezone_id=timezone_id,
        width=width,
        height=height,
        useragent=useragent,
        fingerprint_seed=fingerprint_seed,
        locale=locale,
        accept_language=accept_language,
        webrtc=webrtc
    )

    # Configure search engine defaults in profile Preferences and database
    try:
        default_dir = os.path.join(user_data_dir, 'Default')
        os.makedirs(default_dir, exist_ok=True)
        pref_path = os.path.join(default_dir, 'Preferences')
        prefs = {}
        if os.path.exists(pref_path):
            try:
                with open(pref_path, 'r', encoding='utf-8') as pf:
                    prefs = json.load(pf)
            except Exception:
                prefs = {}
        if 'default_search_provider_data' not in prefs:
            prefs['default_search_provider_data'] = {}
        prefs['default_search_provider_data']['template_url_data'] = {
            "short_name": "Google",
            "keyword": "google.com",
            "url": "https://www.google.com/search?q={searchTerms}",
            "suggestions_url": "https://www.google.com/complete/search?output=chrome&q={searchTerms}",
            "favicon_url": "https://www.google.com/favicon.ico",
            "is_active": 1,
            "prepopulate_id": 1,
            "encoding": "UTF-8"
        }

        # Pre-enable Developer Mode so users can load unpacked external extensions smoothly
        if 'extensions' not in prefs or not isinstance(prefs.get('extensions'), dict):
            prefs['extensions'] = {}
        if 'ui' not in prefs['extensions'] or not isinstance(prefs['extensions'].get('ui'), dict):
            prefs['extensions']['ui'] = {}
        prefs['extensions']['ui']['developer_mode'] = True

        with open(pref_path, 'w', encoding='utf-8') as pf:
            json.dump(prefs, pf, indent=2)

        import sqlite3
        web_data_path = os.path.join(default_dir, 'Web Data')
        if os.path.exists(web_data_path):
            conn = sqlite3.connect(web_data_path, timeout=2.0)
            c = conn.cursor()
            c.execute("""
                UPDATE keywords 
                SET short_name = 'Google',
                    keyword = 'google.com',
                    url = 'https://www.google.com/search?q={searchTerms}',
                    suggest_url = 'https://www.google.com/complete/search?output=chrome&q={searchTerms}',
                    favicon_url = 'https://www.google.com/favicon.ico'
                WHERE prepopulate_id = 1 OR short_name = 'No Search' OR url LIKE 'http://{searchTerms}%';
            """)
            conn.commit()
            conn.close()
    except Exception as e:
        print(f"[Stealth Engine] Note on search config: {e}", flush=True)

    # Build Chrome flags
    if port == 9222 or not port:
        import socket
        allocated = None
        preferred_ports = [9222] + list(range(9223, 9300))
        for p in preferred_ports:
            try:
                with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                    s.bind(('127.0.0.1', p))
                    allocated = p
                    break
            except OSError:
                continue
        port = allocated if allocated else 9222

    custom_exts = custom_extensions or []
    valid_custom_exts = []
    for e in custom_exts:
        resolved = resolve_and_unpack_extension(e, user_data_dir)
        if resolved and resolved not in valid_custom_exts:
            valid_custom_exts.append(resolved)
    all_exts = [ext_dir] + valid_custom_exts
    ext_list_str = ','.join(all_exts)

    chrome_args = [
        CHROME_EXEC,
        f'--user-data-dir={user_data_dir}',
        f'--remote-debugging-port={port}',
        f'--remote-allow-origins=*',
        f'--window-size={width},{height}',
        f'--load-extension={ext_list_str}',
        '--extension-mime-request-handling=always-prompt-for-install',
        '--enable-extensions',
        '--disable-blink-features=AutomationControlled',
        '--silent-debugger-extension-api',
        '--extensions-on-chrome-urls',
        '--disable-popup-blocking',
        '--new-window',
        '--no-first-run',
        '--no-default-browser-check',
    ]

    if useragent:
        chrome_args.append(f'--user-agent={useragent}')
        if 'Android' in useragent or 'iPhone' in useragent or 'iPad' in useragent or 'Mobile' in useragent:
            chrome_args.extend([
                '--touch-events=enabled',
                '--enable-viewport'
            ])

    if locale and locale.strip():
        chrome_args.append(f'--lang={locale.strip()}')

    active_bridge = None
    if proxy_str:
        chrome_args.append('--force-webrtc-ip-handling-policy=disable_non_proxied_udp')
        try:
            from proxy_bridge import start_local_proxy_tunnel
            ptype = 'SOCKS5' if 'socks' in proxy_str.lower() else 'HTTP'
            clean_str = proxy_str.split('://')[-1]
            host_parts = clean_str.split(':')
            px_ip = host_parts[0]
            px_port = host_parts[1]

            active_bridge, local_px_port = start_local_proxy_tunnel(ptype, px_ip, px_port, proxy_user, proxy_pass)
            chrome_args.append(f'--proxy-server=http://127.0.0.1:{local_px_port}')
            print(f"[Stealth Engine] Proxy Bridge active: 127.0.0.1:{local_px_port} -> {ptype} {px_ip}:{px_port}", flush=True)
        except Exception as e:
            print(f"[Stealth Engine] Proxy Bridge error, falling back to direct: {e}", flush=True)
            chrome_args.append(f'--proxy-server={proxy_str}')
    else:
        chrome_args.append('--no-proxy-server')

    if url:
        chrome_args.append(url)

    print(f"[Stealth Engine] Spawning Chrome: {CHROME_EXEC}", flush=True)
    chrome_env = os.environ.copy()
    if timezone_id and timezone_id.strip():
        eff_tz = timezone_id.strip()
        if eff_tz == 'Asia/Calcutta':
            eff_tz = 'Asia/Kolkata'
        chrome_env['TZ'] = eff_tz

    if sys.platform == 'win32':
        proc = subprocess.Popen(
            chrome_args,
            env=chrome_env,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS
        )
    else:
        proc = subprocess.Popen(chrome_args, env=chrome_env)

    # Apply CDP stealth overrides as a secondary reinforcement
    print(f"[Stealth Engine] Waiting for CDP connection on port {port} (extension already active)...", flush=True)
    try:
        try:
            running_loop = asyncio.get_running_loop()
        except RuntimeError:
            running_loop = None

        if running_loop and running_loop.is_running():
            asyncio.create_task(apply_cdp_stealth(port, url, useragent, width, height, webgl_vendor, webgl_renderer, cpu_cores, memory_gb, proxy_user, proxy_pass, profile_id, timezone_id, fingerprint_seed=fingerprint_seed, locale=locale, accept_language=accept_language))
        else:
            new_loop = asyncio.new_event_loop()
            asyncio.set_event_loop(new_loop)
            try:
                new_loop.run_until_complete(apply_cdp_stealth(port, url, useragent, width, height, webgl_vendor, webgl_renderer, cpu_cores, memory_gb, proxy_user, proxy_pass, profile_id, timezone_id, fingerprint_seed=fingerprint_seed, locale=locale, accept_language=accept_language))
            finally:
                new_loop.close()
    except Exception as e:
        print(f"[Stealth Engine CDP Error] {e}", flush=True)
        print(f"[Stealth Engine] Extension-based fingerprint protection is still active.", flush=True)

    return proc.pid, port, active_bridge

if __name__ == '__main__':
    # Default launcher execution
    profile_type = sys.argv[1] if len(sys.argv) > 1 else 'mac'

    if profile_type == 'mobile' or profile_type == 'ios':
        launch_stealth_profile(
            profile_id="prof_mobile_stealth",
            name="iPhone 15 Mobile Profile",
            width=390,
            height=844,
            useragent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/605.1.15",
            proxy_str="",
            port=9230,
            url="about:blank",
            webgl_vendor="Apple Inc.",
            webgl_renderer="Apple GPU",
            cpu_cores=6,
            memory_gb=8
        )
    else:
        launch_stealth_profile(
            profile_id="prof_mac_stealth",
            name="MacBook Pro Stealth Profile",
            width=2560,
            height=1440,
            useragent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            proxy_str="",
            port=9231,
            url="about:blank",
            webgl_vendor="Apple Inc.",
            webgl_renderer="Apple M2",
            cpu_cores=8,
            memory_gb=16
        )
