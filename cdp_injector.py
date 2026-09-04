import sys
import json
import time
import urllib.request
try:
    import websocket # if websocket-client installed
except ImportError:
    websocket = None

# Using standard urllib / websocket protocol to inject CDP overrides into Chrome
def inject_cdp_overrides(port, os_type='macOS'):
    try:
        # Get target pages
        res = urllib.request.urlopen(f'http://localhost:{port}/json')
        pages = json.loads(res.read().decode())
        page = next((p for p in pages if p.get('type') == 'page'), None)
        
        if not page:
            print(f"[CDP Injector] No open page target found on port {port}")
            return False

        ws_url = page.get('webSocketDebuggerUrl')
        print(f"[CDP Injector] Connecting to Chrome DevTools Protocol at {ws_url}...")
        
        is_mac = (os_type.lower() in ['mac', 'macos'])
        plat_val = 'MacIntel' if is_mac else 'Win32'
        os_val = 'macOS' if is_mac else 'Windows'
        arch_val = 'arm' if is_mac else 'x86'
        gpu_ven = 'Apple Inc.' if is_mac else 'Google Inc. (NVIDIA)'
        gpu_ren = 'Apple M3 Max' if is_mac else 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0)'

        override_script = f"""
        if (typeof Navigator !== 'undefined' && Navigator.prototype) {{
          Object.defineProperty(Navigator.prototype, 'platform', {{ get: () => '{plat_val}', configurable: true }});
          Object.defineProperty(Navigator.prototype, 'hardwareConcurrency', {{ get: () => 8, configurable: true }});
          Object.defineProperty(Navigator.prototype, 'deviceMemory', {{ get: () => 8, configurable: true }});
        }}
        ['platform', 'oscpu', 'hardwareConcurrency', 'deviceMemory'].forEach(p => {{
          try {{ if (navigator.hasOwnProperty(p)) delete navigator[p]; }} catch(e) {{}}
        }});
        
        if (navigator.userAgentData) {{
          const mockBrands = [
            {{ brand: 'Not/A)Brand', version: '8' }},
            {{ brand: 'Chromium', version: '150' }},
            {{ brand: 'Google Chrome', version: '150' }}
          ];
          Object.defineProperty(navigator, 'userAgentData', {{
            get: () => ({{
              brands: mockBrands,
              mobile: false,
              platform: '{os_val}',
              getHighEntropyValues: async () => ({{
                brands: mockBrands,
                fullVersionList: [
                  {{ brand: 'Not/A)Brand', version: '8.0.0.0' }},
                  {{ brand: 'Chromium', version: '150.0.7871.128' }},
                  {{ brand: 'Google Chrome', version: '150.0.7871.128' }}
                ],
                platform: '{os_val}',
                platformVersion: '10.0.0',
                architecture: '{arch_val}',
                model: '',
                bitness: '64'
              }})
            }})
          }});
        }}


        // WebGL GPU Spoof
        if (typeof WebGLRenderingContext !== 'undefined') {{
          const getParam = WebGLRenderingContext.prototype.getParameter;
          WebGLRenderingContext.prototype.getParameter = function(param) {{
            if (param === 37445) return '{gpu_ven}';
            if (param === 37446) return '{gpu_ren}';
            return getParam.apply(this, arguments);
          }};
        }}
        """

        print(f"[CDP Injector] CDP Override payload prepared for target OS: {os_type}")
        return True

    except Exception as e:
        print(f"[CDP Injector Error] {e}")
        return False

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 9222
    inject_cdp_overrides(port)
