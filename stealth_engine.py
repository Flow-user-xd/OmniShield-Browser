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
    return {
        'canvasR': (hash_val % 200) + 1,              # 1-200
        'canvasG': ((hash_val >> 8) % 200) + 1,       # 1-200
        'canvasB': ((hash_val >> 16) % 200) + 1,      # 1-200
        'canvasStride': ((hash_val >> 24) % 12) + 4,   # 4-15 (pixel stride, multiplied by 4 in inject.js)
        'audioNoise': ((hash_val >> 32) % 900 + 100) / 10000000000.0,  # unique tiny float per profile
    }


def prepare_profile_extension(profile_id, user_data_dir, webgl_vendor, webgl_renderer, cpu_cores, memory_gb, timezone_id="", width=1920, height=1080, useragent="", fingerprint_seed=None):
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

    # Clear cached DNR rules and Service Worker caches in user_data_dir to guarantee fresh rule compilation
    default_dir = os.path.join(user_data_dir, 'Default')
    for dname in ['DNR Extension Rules', 'Service Worker', 'Cache']:
        target_cache = os.path.join(default_dir, dname)
        if os.path.exists(target_cache):
            try:
                shutil.rmtree(target_cache, ignore_errors=True)
            except Exception:
                pass

    # Compute unique seeds for this profile using fingerprint_seed if available
    seed_str = fingerprint_seed or profile_id
    seeds = compute_profile_fingerprint_seeds(seed_str)

    # Generate the per-profile config.js
    config_content = f"""// OmniShield Profile Config - Auto-generated for: {profile_id}
const OMNI_CFG = {{
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
  searchEngine: "duckduckgo"
}};
if (typeof self !== 'undefined') self.__OMNI_CONFIG = OMNI_CFG;
if (typeof window !== 'undefined') window.__OMNI_CONFIG = OMNI_CFG;
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


async def apply_cdp_stealth(port, target_url, ua_str, width, height, webgl_vendor, webgl_renderer, cpu_cores, memory_gb, proxy_user="", proxy_pass="", profile_id="prof-1", timezone_id="America/New_York", fingerprint_seed=None):
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

    # Build the CDP injection payload (serves as a secondary reinforcement of extension injection)
    cdp_payload = f"""
    (function() {{
      // Screen resolution & color depth spoofing reinforcement
      try {{
        const targetW = {int(width)};
        const targetH = {int(height)};
        const screenDescriptors = {{
          width: {{ get: function() {{ return targetW; }}, configurable: true, enumerable: true }},
          height: {{ get: function() {{ return targetH; }}, configurable: true, enumerable: true }},
          availWidth: {{ get: function() {{ return targetW; }}, configurable: true, enumerable: true }},
          availHeight: {{ get: function() {{ return targetH - 40; }}, configurable: true, enumerable: true }},
          colorDepth: {{ get: function() {{ return 24; }}, configurable: true, enumerable: true }},
          pixelDepth: {{ get: function() {{ return 24; }}, configurable: true, enumerable: true }},
          availLeft: {{ get: function() {{ return 0; }}, configurable: true, enumerable: true }},
          availTop: {{ get: function() {{ return 0; }}, configurable: true, enumerable: true }}
        }};
        if (typeof Screen !== 'undefined' && Screen.prototype) {{
          try {{ Object.defineProperties(Screen.prototype, screenDescriptors); }} catch(e) {{}}
        }}
        if (typeof window !== 'undefined' && window.screen) {{
          try {{ Object.defineProperties(window.screen, screenDescriptors); }} catch(e) {{}}
        }}
        try {{
          Object.defineProperty(window, 'devicePixelRatio', {{ get: () => {target_dpr}, configurable: true }});
          Object.defineProperty(window, 'outerWidth', {{ get: () => targetW, configurable: true }});
          Object.defineProperty(window, 'outerHeight', {{ get: () => targetH - 40, configurable: true }});
          Object.defineProperty(window, 'innerWidth', {{ get: () => targetW, configurable: true }});
          Object.defineProperty(window, 'innerHeight', {{ get: () => targetH - 85, configurable: true }});
        }} catch(e) {{}}
      }} catch(e) {{}}

      // Screen orientation reinforcement — real desktop Chrome always reports
      // 'landscape-primary' regardless of claimed device. A portrait phone/
      // tablet profile with the desktop's real orientation is an easy,
      // commonly-checked tell, so this ties it to the claimed resolution.
      try {{
        const isPortrait = {int(height)} > {int(width)};
        const orientType = isPortrait ? 'portrait-primary' : 'landscape-primary';
        const orientAngle = isPortrait ? 0 : 90;
        if (window.screen && window.screen.orientation) {{
          try {{
            Object.defineProperty(ScreenOrientation.prototype, 'type', {{ get: () => orientType, configurable: true }});
            Object.defineProperty(ScreenOrientation.prototype, 'angle', {{ get: () => orientAngle, configurable: true }});
          }} catch(e) {{}}
          try {{
            Object.defineProperty(window.screen.orientation, 'type', {{ get: () => orientType, configurable: true }});
            Object.defineProperty(window.screen.orientation, 'angle', {{ get: () => orientAngle, configurable: true }});
          }} catch(e) {{}}
        }}
      }} catch(e) {{}}

      // Pointer/hover media-feature reinforcement — real desktop Chrome
      // reports pointer:fine / hover:hover from actual detected input
      // hardware, independent of any touch-emulation flag. Any site
      // checking window.matchMedia('(pointer: coarse)') etc. sees straight
      // through a mobile profile without this.
      try {{
        const wantsTouchProfile = {json.dumps('Android' in ua_str or 'iPhone' in ua_str or 'iPad' in ua_str)};
        if (wantsTouchProfile && window.matchMedia) {{
          const origMatchMedia = window.matchMedia.bind(window);
          window.matchMedia = function(query) {{
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
        }}
      }} catch(e) {{}}

      // Hardware & Navigator spoofing reinforcement via CDP (Prototype Only, Anti-Deception)
      try {{
        const nativeFnToString = Function.prototype.toString;
        const nativeMap = new WeakMap();

        function makeNative(fn, name) {{
          if (name) {{
            try {{ Object.defineProperty(fn, 'name', {{ value: name, configurable: true }}); }} catch(e) {{}}
          }}
          nativeMap.set(fn, name || (fn.name || ''));
          return fn;
        }}

        try {{
          const patchedToString = function() {{
            if (nativeMap.has(this)) {{
              const n = nativeMap.get(this);
              return `function ${{n}}() {{ [native code] }}`;
            }}
            return nativeFnToString.call(this);
          }};
          makeNative(patchedToString, 'toString');
          Function.prototype.toString = patchedToString;
        }} catch(e) {{}}

        // Clean any own properties on navigator to ensure navigator.hasOwnProperty(p) === false
        const propsToClean = [
          'webdriver', 'platform', 'hardwareConcurrency', 'deviceMemory',
          'languages', 'userAgent', 'appVersion', 'maxTouchPoints',
          'pdfViewerEnabled', 'userAgentData', 'plugins', 'mimeTypes', 'getBattery'
        ];
        for (const p of propsToClean) {{
          try {{ if (navigator.hasOwnProperty(p)) delete navigator[p]; }} catch(e) {{}}
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
            const getter = function() {{ return val; }};
            makeNative(getter, `get ${{prop}}`);
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
          defProtoGetter('deviceMemory', {int(memory_gb)});
          defProtoGetter('languages', Object.freeze(['en-US', 'en']));
          defProtoGetter('userAgent', {json.dumps(ua_str)});
          defProtoGetter('appVersion', {json.dumps(ua_str.replace('Mozilla/', ''))});
          defProtoGetter('maxTouchPoints', (isAndroid || isIOS) ? 5 : 0);
          defProtoGetter('pdfViewerEnabled', !(isAndroid || isIOS));

          // Native Plugins
          function createPluginArray() {{
            if (isAndroid || isIOS) {{
              const arr = Object.create(PluginArray.prototype);
              Object.defineProperty(arr, 'length', {{ value: 0 }});
              arr.item = makeNative(function() {{ return null; }}, 'item');
              arr.namedItem = makeNative(function() {{ return null; }}, 'namedItem');
              arr.refresh = makeNative(function() {{}}, 'refresh');
              Object.defineProperty(arr, Symbol.toStringTag, {{ value: 'PluginArray' }});
              return arr;
            }}
            const plugins = [
              {{ name: 'PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' }},
              {{ name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' }},
              {{ name: 'Chromium PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' }},
              {{ name: 'Microsoft Edge PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' }},
              {{ name: 'WebKit built-in PDF', filename: 'internal-pdf-viewer', description: 'Portable Document Format' }}
            ];
            const arr = Object.create(PluginArray.prototype);
            plugins.forEach((p, idx) => {{
              const pluginObj = Object.create(Plugin.prototype);
              Object.defineProperty(pluginObj, 'name', {{ value: p.name, enumerable: true, configurable: true }});
              Object.defineProperty(pluginObj, 'filename', {{ value: p.filename, enumerable: true, configurable: true }});
              Object.defineProperty(pluginObj, 'description', {{ value: p.description, enumerable: true, configurable: true }});
              Object.defineProperty(pluginObj, 'length', {{ value: 0, enumerable: true, configurable: true }});
              Object.defineProperty(pluginObj, Symbol.toStringTag, {{ value: 'Plugin' }});
              arr[idx] = pluginObj;
              arr[p.name] = pluginObj;
            }});
            Object.defineProperty(arr, 'length', {{ value: plugins.length }});
            arr.item = makeNative(function(i) {{ return this[i] || null; }}, 'item');
            arr.namedItem = makeNative(function(name) {{ return this[name] || null; }}, 'namedItem');
            arr.refresh = makeNative(function() {{}}, 'refresh');
            Object.defineProperty(arr, Symbol.toStringTag, {{ value: 'PluginArray' }});
            return arr;
          }}

          defProtoGetter('plugins', createPluginArray());

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
            const getBatteryFn = function() {{ return Promise.resolve(mockBattery); }};
            makeNative(getBatteryFn, 'getBattery');
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
          const patchedEnumerate = async function() {{
            return fakeDevs.map(d => Object.assign(Object.create(window.MediaDeviceInfo ? window.MediaDeviceInfo.prototype : Object.prototype), d));
          }};
          makeNative(patchedEnumerate, 'enumerateDevices');
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
        const patchedGetParam = function(param) {{
          const res = getParam.apply(this, arguments);
          if (param === 37445) return vendor;
          if (param === 37446) return renderer;
          return res;
        }};
        makeNative(patchedGetParam, 'getParameter');
        WebGLRenderingContext.prototype.getParameter = patchedGetParam;

        if (window.WebGL2RenderingContext) {{
          const getParam2 = WebGL2RenderingContext.prototype.getParameter;
          const patchedGetParam2 = function(param) {{
            const res = getParam2.apply(this, arguments);
            if (param === 37445) return vendor;
            if (param === 37446) return renderer;
            return res;
          }};
          makeNative(patchedGetParam2, 'getParameter');
          WebGL2RenderingContext.prototype.getParameter = patchedGetParam2;
        }}

        // Texture-compression support is a much harder tell than the vendor/
        // renderer strings: real Windows GPUs (ANGLE/Direct3D) support
        // S3TC/DXT; real mobile GPUs support ETC2/ASTC and essentially never
        // S3TC. Claiming a mobile renderer string while still reporting
        // desktop compression formats (or vice versa) is a direct giveaway
        // regardless of what getParameter(37445/37446) says.
        const DESKTOP_ONLY_EXT = ['WEBGL_compressed_texture_s3tc', 'WEBGL_compressed_texture_s3tc_srgb', 'EXT_texture_compression_bptc', 'EXT_texture_compression_rgtc'];
        const MOBILE_ONLY_EXT = ['WEBGL_compressed_texture_etc', 'WEBGL_compressed_texture_etc1', 'WEBGL_compressed_texture_astc', 'WEBGL_compressed_texture_pvrtc'];

        const patchExtensions = (proto) => {{
          const origGetSupported = proto.getSupportedExtensions;
          const origGetExtension = proto.getExtension;
          if (origGetSupported) {{
            const patchedGetSupported = function () {{
              let list = origGetSupported.apply(this, arguments) || [];
              list = isMobileGPU
                ? list.filter((e) => !DESKTOP_ONLY_EXT.includes(e))
                : list.filter((e) => !MOBILE_ONLY_EXT.includes(e));
              return list;
            }};
            makeNative(patchedGetSupported, 'getSupportedExtensions');
            proto.getSupportedExtensions = patchedGetSupported;
          }}
          if (origGetExtension) {{
            const patchedGetExtension = function (name) {{
              if (isMobileGPU && DESKTOP_ONLY_EXT.includes(name)) return null;
              if (!isMobileGPU && MOBILE_ONLY_EXT.includes(name)) return null;
              return origGetExtension.apply(this, arguments);
            }};
            makeNative(patchedGetExtension, 'getExtension');
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
          for (let i = 0; i < data.length; i += step) {{
            if (data[i + 3] > 0) {{
              data[i]     = (data[i]     + rShift) & 255;
              data[i + 1] = (data[i + 1] + gShift) & 255;
              data[i + 2] = (data[i + 2] + bShift) & 255;
            }}
          }}
        }}

        function hookCanvasWindow(targetWin) {{
          if (!targetWin || targetWin.__omni_canvas_hooked) return;
          try {{ targetWin.__omni_canvas_hooked = true; }} catch(e) {{}}
          try {{
            if (!targetWin.HTMLCanvasElement || !targetWin.CanvasRenderingContext2D) return;
            const origToDataURL = targetWin.HTMLCanvasElement.prototype.toDataURL;
            const origGetImageData = targetWin.CanvasRenderingContext2D.prototype.getImageData;
            const origToBlob = targetWin.HTMLCanvasElement.prototype.toBlob;

            targetWin.HTMLCanvasElement.prototype.toDataURL = function() {{
              try {{
                const ctx = this.getContext('2d');
                if (ctx) {{
                  const imgData = origGetImageData.call(ctx, 0, 0, this.width, this.height);
                  if (imgData && imgData.data) {{
                    applyPixelNoise(imgData.data);
                    ctx.putImageData(imgData, 0, 0);
                  }}
                }}
              }} catch (err) {{}}
              return origToDataURL.apply(this, arguments);
            }};

            targetWin.CanvasRenderingContext2D.prototype.getImageData = function(x, y, w, h) {{
              const res = origGetImageData.apply(this, arguments);
              try {{
                if (res && res.data) applyPixelNoise(res.data);
              }} catch (e) {{}}
              return res;
            }};

            targetWin.HTMLCanvasElement.prototype.toBlob = function(callback, type, quality) {{
              try {{
                const ctx = this.getContext('2d');
                if (ctx) {{
                  const imgData = origGetImageData.call(ctx, 0, 0, this.width, this.height);
                  if (imgData && imgData.data) {{
                    applyPixelNoise(imgData.data);
                    ctx.putImageData(imgData, 0, 0);
                  }}
                }}
              }} catch (err) {{}}
              return origToBlob.call(this, callback, type, quality);
            }};
          }} catch (e) {{}}
        }}

        hookCanvasWindow(window);

        try {{
          const descWin = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow');
          const descDoc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentDocument');

          if (descWin && descWin.get) {{
            Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {{
              get: function() {{
                const w = descWin.get.call(this);
                if (w) hookCanvasWindow(w);
                return w;
              }},
              configurable: true,
              enumerable: true
            }});
          }}

          if (descDoc && descDoc.get) {{
            Object.defineProperty(HTMLIFrameElement.prototype, 'contentDocument', {{
              get: function() {{
                const d = descDoc.get.call(this);
                if (d && d.defaultView) hookCanvasWindow(d.defaultView);
                return d;
              }},
              configurable: true,
              enumerable: true
            }});
          }}
        }} catch (e) {{}}
      }} catch(e) {{}}
    }})();
    """

    try:
        async with websockets.connect(ws_url, close_timeout=5) as ws:
            # 1. Enable Page Agent
            await ws.send(json.dumps({"id": 1, "method": "Page.enable"}))
            await ws.recv()

            # 2. Proxy Auth handling
            if proxy_user and proxy_pass:
                await ws.send(json.dumps({
                    "id": 6,
                    "method": "Fetch.enable",
                    "params": { "handleAuthRequests": True }
                }))
                await ws.recv()

                async def persistent_proxy_auth_loop():
                    while True:
                        try:
                            msg = await ws.recv()
                            data = json.loads(msg)
                            if data.get('method') == 'Fetch.authRequired':
                                req_id = data['params']['requestId']
                                await ws.send(json.dumps({
                                    "id": 7,
                                    "method": "Fetch.continueWithAuth",
                                    "params": {
                                        "requestId": req_id,
                                        "authChallengeResponse": {
                                            "response": "ProvideCredentials",
                                            "username": proxy_user,
                                            "password": proxy_pass
                                        }
                                    }
                                }))
                        except Exception:
                            break

                asyncio.create_task(persistent_proxy_auth_loop())

            # 3. Inject CDP reinforcement script for future navigations
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

            # Build unified UA & Client Hints payload
            ua_override_params = {
                "userAgent": ua_str,
                "acceptLanguage": "en-US,en;q=0.9",
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
                    "dontSetVisibleSize": False
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

            # 5c. Timezone Override via CDP (normalizes Asia/Calcutta to Asia/Kolkata, defaults to Asia/Kolkata for host IP alignment)
            eff_tz = timezone_id.strip() if (timezone_id and timezone_id.strip()) else "Asia/Kolkata"
            if eff_tz == 'Asia/Calcutta':
                eff_tz = 'Asia/Kolkata'
            await ws.send(json.dumps({
                "id": 8,
                "method": "Emulation.setTimezoneOverride",
                "params": { "timezoneId": eff_tz }
            }))
            await ws.recv()

            # 6. Navigate to target URL (triggers extension + CDP scripts on fresh load)
            await ws.send(json.dumps({
                "id": 5,
                "method": "Page.navigate",
                "params": { "url": target_url }
            }))
            await ws.recv()

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


def launch_stealth_profile(profile_id, name, width, height, useragent, proxy_str, port=9222, url="https://browserleaks.com/canvas", webgl_vendor="Google Inc. (NVIDIA)", webgl_renderer="ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0)", cpu_cores=8, memory_gb=16, proxy_user="", proxy_pass="", timezone_id="America/New_York", custom_extensions=None, fingerprint_seed=None):
    useragent = sanitize_user_agent(useragent, name)
    print(f"[Stealth Engine] launch_stealth_profile called for: {name} (proxy={bool(proxy_str)}, tz={timezone_id}, seed={fingerprint_seed})", flush=True)

    safe_name = "".join(c if c.isalnum() else "_" for c in name).lower()
    user_data_dir = os.path.join(PROFILES_DIR, f"{profile_id}_{safe_name}")
    os.makedirs(user_data_dir, exist_ok=True)

    # Clean up old SingletonLock if leftover from previous crashed Chrome instance
    lockfile = os.path.join(user_data_dir, 'SingletonLock')
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
        fingerprint_seed=fingerprint_seed
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
    import random
    if port == 9222:
        port = random.randint(9200, 9500)

    custom_exts = custom_extensions or []
    valid_custom_exts = [e.strip() for e in custom_exts if isinstance(e, str) and e.strip() and os.path.exists(e.strip())]
    all_exts = [ext_dir] + valid_custom_exts
    ext_list_str = ','.join(all_exts)

    chrome_args = [
        CHROME_EXEC,
        f'--user-data-dir={user_data_dir}',
        f'--remote-debugging-port={port}',
        f'--window-size={width},{height}',
        f'--load-extension={ext_list_str}',
        f'--disable-extensions-except={ext_list_str}',
        '--new-window',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-background-networking',
        '--disable-blink-features=AutomationControlled',
        '--test-type',
        '--disable-infobars',
        '--remote-allow-origins=*',
    ]

    if useragent:
        chrome_args.append(f'--user-agent={useragent}')
        if 'Android' in useragent or 'iPhone' in useragent or 'iPad' in useragent or 'Mobile' in useragent:
            chrome_args.extend([
                '--touch-events=enabled',
                '--enable-viewport'
            ])

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
    if sys.platform == 'win32':
        proc = subprocess.Popen(
            chrome_args,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS
        )
    else:
        proc = subprocess.Popen(chrome_args)

    # Apply CDP stealth overrides as a secondary reinforcement
    print(f"[Stealth Engine] Waiting for CDP connection on port {port} (extension already active)...", flush=True)
    try:
        try:
            running_loop = asyncio.get_running_loop()
        except RuntimeError:
            running_loop = None

        if running_loop and running_loop.is_running():
            asyncio.create_task(apply_cdp_stealth(port, url, useragent, width, height, webgl_vendor, webgl_renderer, cpu_cores, memory_gb, proxy_user, proxy_pass, profile_id, timezone_id, fingerprint_seed=fingerprint_seed))
        else:
            new_loop = asyncio.new_event_loop()
            asyncio.set_event_loop(new_loop)
            try:
                new_loop.run_until_complete(apply_cdp_stealth(port, url, useragent, width, height, webgl_vendor, webgl_renderer, cpu_cores, memory_gb, proxy_user, proxy_pass, profile_id, timezone_id, fingerprint_seed=fingerprint_seed))
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
            url="https://browserleaks.com/canvas",
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
            url="https://browserleaks.com/canvas",
            webgl_vendor="Apple Inc.",
            webgl_renderer="Apple M2",
            cpu_cores=8,
            memory_gb=16
        )
