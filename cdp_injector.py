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
        
        # Script to inject before any page scripts run (Page.addScriptToEvaluateOnNewDocument)
        override_script = """
        if (typeof Navigator !== 'undefined' && Navigator.prototype) {
          Object.defineProperty(Navigator.prototype, 'platform', { get: () => 'MacIntel', configurable: true });
          Object.defineProperty(Navigator.prototype, 'oscpu', { get: () => 'Intel Mac OS X 10.15', configurable: true });
          Object.defineProperty(Navigator.prototype, 'hardwareConcurrency', { get: () => 12, configurable: true });
          Object.defineProperty(Navigator.prototype, 'deviceMemory', { get: () => 8, configurable: true });
        }
        ['platform', 'oscpu', 'hardwareConcurrency', 'deviceMemory'].forEach(p => {
          try { if (navigator.hasOwnProperty(p)) delete navigator[p]; } catch(e) {}
        });
        
        if (navigator.userAgentData) {
          Object.defineProperty(navigator, 'userAgentData', {
            get: () => ({
              brands: [{ brand: 'Chromium', version: '126' }, { brand: 'Google Chrome', version: '126' }],
              mobile: false,
              platform: 'macOS',
              getHighEntropyValues: async () => ({ platform: 'macOS', platformVersion: '14.2.0', architecture: 'arm', model: '', bitness: '64' })
            })
          });
        }

        // WebGL GPU Spoof
        const getParam = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(param) {
          if (param === 37445) return 'Apple Inc.';
          if (param === 37446) return 'Apple M3 Max';
          return getParam.apply(this, arguments);
        };
        """

        print(f"[CDP Injector] CDP Override payload prepared for target OS: {os_type}")
        return True

    except Exception as e:
        print(f"[CDP Injector Error] {e}")
        return False

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 9222
    inject_cdp_overrides(port)
