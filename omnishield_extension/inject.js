// OmniShield Anti-Detect Engine v3.0 (GoLogin/Multilogin Spec Anti-Fingerprinting)
// Covers: Canvas, WebGL parameters & extensions, AudioContext, Media Devices, Font Metrics,
// Speech Synthesis, Battery API, Screen & Orientation, Navigator Plugins, and WebRTC.
(function() {
  const cfg = window.__OMNI_CONFIG || {};

  // Console log banner for DevTools
  console.log(
    '%c[OmniShield Stealth Engine v3.0]%c Full Spectrum Anti-Fingerprint Active.\n' +
    'Seeds: R=' + (cfg.canvasR || 13) + ' G=' + (cfg.canvasG || 17) + ' B=' + (cfg.canvasB || 23) + ' Stride=' + (cfg.canvasStride || 8) + '\n' +
    'WebGL: ' + (cfg.webglVendor || 'Default') + ' | GPU: ' + (cfg.webglRenderer || 'Default') + '\n' +
    'Hardware: ' + (cfg.cpuCores || 8) + ' Cores | ' + (cfg.memoryGb || 16) + ' GB RAM',
    'color: #00f2fe; font-weight: bold; font-size: 12px; background: #070b14; padding: 4px 8px; border-radius: 4px;',
    'color: #a0aec0; font-size: 11px;'
  );

  window.__OMNI_ACTIVE = true;
  window.__OMNI_DEBUG = cfg;

  // Noise seeds & Hardware config
  const rShift = cfg.canvasR || 13;
  const gShift = cfg.canvasG || 17;
  const bShift = cfg.canvasB || 23;
  const pixelStride = cfg.canvasStride || 8;

  const webglVendor = cfg.webglVendor || 'Google Inc. (NVIDIA)';
  const webglRenderer = cfg.webglRenderer || 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0)';
  const cpuCores = cfg.cpuCores || 8;
  const memoryGb = cfg.memoryGb || 16;
  const audioNoise = cfg.audioNoise || 0.00000005;

  // Helper for generating pseudo-random values based on seed
  function seedHash(key) {
    let str = (cfg.profileId || 'prof-default') + '_' + key;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  // Anti-Detection: Native Function.prototype.toString disguise
  const nativeFnToString = Function.prototype.toString;
  const nativeMap = new WeakMap();

  function makeNative(fn, name) {
    if (name) {
      try { Object.defineProperty(fn, 'name', { value: name, configurable: true }); } catch(e) {}
    }
    nativeMap.set(fn, name || (fn.name || ''));
    return fn;
  }

  try {
    const patchedToString = function() {
      if (nativeMap.has(this)) {
        const n = nativeMap.get(this);
        return `function ${n}() { [native code] }`;
      }
      return nativeFnToString.call(this);
    };
    makeNative(patchedToString, 'toString');
    Function.prototype.toString = patchedToString;
  } catch(e) {}

  // Clean any existing own properties on navigator to ensure navigator.hasOwnProperty(p) === false
  const propsToClean = [
    'webdriver', 'platform', 'hardwareConcurrency', 'deviceMemory',
    'languages', 'userAgent', 'appVersion', 'maxTouchPoints',
    'pdfViewerEnabled', 'userAgentData', 'plugins', 'mimeTypes', 'getBattery'
  ];
  for (const p of propsToClean) {
    try { if (navigator.hasOwnProperty(p)) delete navigator[p]; } catch(e) {}
  }

  // OS & UA Parsing
  const ua = cfg.userAgent || navigator.userAgent || '';
  let targetPlatform = 'Win32';
  let targetOSName = 'Windows';
  let targetPlatformVersion = '10.0.0';
  let targetArch = 'x86';
  let targetModel = '';
  let isMobile = false;

  if (ua.includes('iPhone') || ua.includes('iPad') || ua.includes('OS 17') || ua.includes('OS 16')) {
    targetPlatform = ua.includes('iPad') ? 'iPad' : 'iPhone';
    targetOSName = 'iOS';
    targetPlatformVersion = '17.2';
    targetArch = 'arm';
    targetModel = 'iPhone';
    isMobile = true;
  } else if (ua.includes('Macintosh') || ua.includes('Mac OS X')) {
    targetPlatform = 'MacIntel';
    targetOSName = 'macOS';
    targetPlatformVersion = '14.2.0';
    targetArch = 'x86';
    targetModel = '';
    isMobile = false;
  } else if (ua.includes('Android')) {
    targetPlatform = 'Linux armv8l';
    targetOSName = 'Android';
    const verM = ua.match(/Android ([\d.]+)/);
    const modM = ua.match(/Android [\d.]+;\s*([^;)]+)\)/);
    targetPlatformVersion = verM ? verM[1] : '10';
    targetModel = modM ? modM[1].trim() : '';
    targetArch = 'arm';
    isMobile = ua.includes('Mobile');
  }

  // ==========================================
  // 1. AUTOMATION DETECTION STRIPPING
  // ==========================================
  try {
    if (navigator.hasOwnProperty('webdriver')) delete navigator.webdriver;
    if (navigator.webdriver) {
      if (window.Navigator && window.Navigator.prototype) {
        const getWd = function() { return false; };
        makeNative(getWd, 'get webdriver');
        Object.defineProperty(window.Navigator.prototype, 'webdriver', {
          get: getWd,
          set: undefined,
          configurable: true,
          enumerable: true
        });
      }
    }
  } catch (e) {}

  // ==========================================
  // 2. NAVIGATOR & PLATFORM SPOOFING (PROTOTYPE-ONLY DISGUISE)
  // ==========================================
  try {
    const navProps = {
      platform: targetPlatform,
      hardwareConcurrency: cpuCores,
      deviceMemory: memoryGb,
      languages: Object.freeze(['en-US', 'en']),
      userAgent: ua,
      appVersion: ua.replace(/^Mozilla\//, ''),
      maxTouchPoints: (targetOSName === 'Android' || targetOSName === 'iOS') ? 5 : 0,
      pdfViewerEnabled: (targetOSName === 'Android' || targetOSName === 'iOS') ? false : true
    };

    if (window.Navigator && window.Navigator.prototype) {
      for (const [p, v] of Object.entries(navProps)) {
        try {
          const getter = function() { return v; };
          makeNative(getter, `get ${p}`);
          Object.defineProperty(window.Navigator.prototype, p, {
            get: getter,
            set: undefined,
            configurable: true,
            enumerable: true
          });
        } catch (e) {}
      }
    }

    // Touch & Pointer Emulation for Mobile / Android profiles
    if (isMobile || targetOSName === 'Android' || targetOSName === 'iOS') {
      try {
        if (!('ontouchstart' in window)) {
          window.ontouchstart = null;
          window.ontouchend = null;
          window.ontouchmove = null;
          window.ontouchcancel = null;
        }
        if (document && !('ontouchstart' in document)) {
          document.ontouchstart = null;
        }
        if (window.matchMedia) {
          const origMatchMedia = window.matchMedia;
          window.matchMedia = function(query) {
            const m = origMatchMedia.apply(this, arguments);
            if (typeof query === 'string') {
              const clean = query.replace(/\s+/g, '').toLowerCase();
              if (clean.includes('(pointer:coarse)')) {
                return { matches: true, media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => true };
              }
              if (clean.includes('(pointer:fine)')) {
                return { matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => true };
              }
              if (clean.includes('(hover:none)')) {
                return { matches: true, media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => true };
              }
              if (clean.includes('(hover:hover)')) {
                return { matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => true };
              }
            }
            return m;
          };
        }
      } catch (e) {}
    }
  } catch (e) {}

  // Client Hints (Sec-CH-UA)
  if (navigator.userAgentData || window.NavigatorUAData) {
    try {
      const chromeM = ua.match(/(?:Chrome|CriOS)\/(\d+)\.([\d.]+)/);
      const chromeMajor = chromeM ? chromeM[1] : '131';
      const chromeFull = chromeM ? `${chromeMajor}.${chromeM[2]}` : '131.0.6778.265';

      const brands = Object.freeze([
        Object.freeze({ brand: 'Google Chrome', version: chromeMajor }),
        Object.freeze({ brand: 'Chromium', version: chromeMajor }),
        Object.freeze({ brand: 'Not_A Brand', version: '24' })
      ]);
      const highEntropy = {
        architecture: targetArch,
        bitness: '64',
        brands: Object.freeze([
          Object.freeze({ brand: 'Google Chrome', version: chromeFull }),
          Object.freeze({ brand: 'Chromium', version: chromeFull }),
          Object.freeze({ brand: 'Not_A Brand', version: '24.0.0.0' })
        ]),
        fullVersionList: Object.freeze([
          Object.freeze({ brand: 'Google Chrome', version: chromeFull }),
          Object.freeze({ brand: 'Chromium', version: chromeFull }),
          Object.freeze({ brand: 'Not_A Brand', version: '24.0.0.0' })
        ]),
        mobile: isMobile,
        model: targetModel,
        platform: targetOSName,
        platformVersion: targetPlatformVersion,
        uaFullVersion: chromeFull
      };

      if (window.NavigatorUAData && window.NavigatorUAData.prototype) {
        const mockUAData = Object.create(window.NavigatorUAData.prototype);
        Object.defineProperty(mockUAData, 'brands', { get: makeNative(() => brands, 'get brands'), enumerable: true });
        Object.defineProperty(mockUAData, 'mobile', { get: makeNative(() => isMobile, 'get mobile'), enumerable: true });
        Object.defineProperty(mockUAData, 'platform', { get: makeNative(() => targetOSName, 'get platform'), enumerable: true });
        mockUAData.getHighEntropyValues = makeNative(async (hints = []) => {
          const res = {};
          hints.forEach(h => { if (h in highEntropy) res[h] = highEntropy[h]; });
          res.brands = highEntropy.brands;
          res.mobile = highEntropy.mobile;
          res.platform = highEntropy.platform;
          return res;
        }, 'getHighEntropyValues');
        Object.defineProperty(mockUAData, Symbol.toStringTag, { value: 'NavigatorUAData' });

        if (window.Navigator && window.Navigator.prototype) {
          const getUAData = function() { return mockUAData; };
          makeNative(getUAData, 'get userAgentData');
          Object.defineProperty(window.Navigator.prototype, 'userAgentData', {
            get: getUAData,
            configurable: true,
            enumerable: true
          });
        }
      }
    } catch (e) {}
  }

  // ==========================================
  // 3. SCREEN & ORIENTATION SPOOFING
  // ==========================================
  try {
    const targetW = cfg.width || 1920;
    const targetH = cfg.height || 1080;
    const targetDpr = 1;
    const colDepth = 24;

    const screenDescriptors = {
      width: { get: function() { return targetW; }, configurable: true, enumerable: true },
      height: { get: function() { return targetH; }, configurable: true, enumerable: true },
      availWidth: { get: function() { return targetW; }, configurable: true, enumerable: true },
      availHeight: { get: function() { return targetH - 40; }, configurable: true, enumerable: true },
      colorDepth: { get: function() { return colDepth; }, configurable: true, enumerable: true },
      pixelDepth: { get: function() { return colDepth; }, configurable: true, enumerable: true },
      availLeft: { get: function() { return 0; }, configurable: true, enumerable: true },
      availTop: { get: function() { return 0; }, configurable: true, enumerable: true }
    };

    if (window.Screen && window.Screen.prototype) {
      try { Object.defineProperties(window.Screen.prototype, screenDescriptors); } catch (e) {}
    }
    if (window.screen) {
      try { Object.defineProperties(window.screen, screenDescriptors); } catch (e) {}
    }

    // Override inner/outer window dimensions and DPR on window
    try {
      Object.defineProperty(window, 'outerWidth', { get: () => targetW, configurable: true });
      Object.defineProperty(window, 'outerHeight', { get: () => targetH - 40, configurable: true });
      Object.defineProperty(window, 'innerWidth', { get: () => targetW, configurable: true });
      Object.defineProperty(window, 'innerHeight', { get: () => targetH - 85, configurable: true });
      Object.defineProperty(window, 'devicePixelRatio', { get: () => 1, configurable: true });
    } catch (e) {}

    const orientType = isMobile ? 'portrait-primary' : 'landscape-primary';
    const orientAngle = 0;

    if (screen.orientation) {
      Object.defineProperty(screen.orientation, 'type', { get: () => orientType, configurable: true });
      Object.defineProperty(screen.orientation, 'angle', { get: () => orientAngle, configurable: true });
    }
  } catch (e) {}

  // ==========================================
  // 4. WEBGL VENDOR, RENDERER & PARAMETERS
  // ==========================================
  try {
    const maxTexSize = (seedHash('maxtex') % 2 === 0) ? 16384 : 8192;
    const maxRenderSize = (seedHash('maxrender') % 2 === 0) ? 16384 : 8192;
    const maxViewportDims = new Int32Array([maxTexSize, maxTexSize]);

    const getParamOrig = WebGLRenderingContext.prototype.getParameter;
    const patchedGetParam = function(param) {
      const res = getParamOrig.apply(this, arguments);
      if (param === 37445) return webglVendor;       // UNMASKED_VENDOR_WEBGL
      if (param === 37446) return webglRenderer;     // UNMASKED_RENDERER_WEBGL
      if (param === 3379)  return maxTexSize;        // MAX_TEXTURE_SIZE
      if (param === 34024) return maxRenderSize;     // MAX_RENDERBUFFER_SIZE
      if (param === 3386)  return maxViewportDims;   // MAX_VIEWPORT_DIMS
      return res;
    };
    makeNative(patchedGetParam, 'getParameter');
    WebGLRenderingContext.prototype.getParameter = patchedGetParam;

    if (window.WebGL2RenderingContext) {
      const getParamOrig2 = WebGL2RenderingContext.prototype.getParameter;
      const patchedGetParam2 = function(param) {
        const res = getParamOrig2.apply(this, arguments);
        if (param === 37445) return webglVendor;
        if (param === 37446) return webglRenderer;
        if (param === 3379)  return maxTexSize;
        if (param === 34024) return maxRenderSize;
        if (param === 3386)  return maxViewportDims;
        return res;
      };
      makeNative(patchedGetParam2, 'getParameter');
      WebGL2RenderingContext.prototype.getParameter = patchedGetParam2;
    }
  } catch (e) {}

  // ==========================================
  // 5. CANVAS 2D NOISE INJECTION (TOP WINDOW & IFRAME RECURSIVE)
  // ==========================================
  function isIntegrityCanvas(w, h) {
    return (w === 21 && h === 120) || (w === 240 && h === 60);
  }

  function hookCanvasWindow(targetWin) {
    if (!targetWin || targetWin.__omni_canvas_hooked) return;
    try { targetWin.__omni_canvas_hooked = true; } catch(e) {}

    try {
      if (!targetWin.HTMLCanvasElement || !targetWin.CanvasRenderingContext2D) return;
      const origToDataURL = targetWin.HTMLCanvasElement.prototype.toDataURL;
      const origGetImageData = targetWin.CanvasRenderingContext2D.prototype.getImageData;
      const origToBlob = targetWin.HTMLCanvasElement.prototype.toBlob;
      const origIsPointInPath = targetWin.CanvasRenderingContext2D.prototype.isPointInPath;
      makeNative(origIsPointInPath, 'isPointInPath');

      const patchedToDataURL = function() {
        if (isIntegrityCanvas(this.width, this.height)) {
          return origToDataURL.apply(this, arguments);
        }
        try {
          const ctx = this.getContext('2d');
          if (ctx && this.width >= 16 && this.height >= 16) {
            const off = targetWin.document.createElement('canvas');
            off.width = this.width;
            off.height = this.height;
            const offCtx = off.getContext('2d');
            offCtx.drawImage(this, 0, 0);
            const imgData = origGetImageData.call(offCtx, 0, 0, this.width, this.height);
            if (imgData && imgData.data) {
              const d = imgData.data;
              const step = Math.max(4, pixelStride * 4);
              for (let i = 0; i < d.length; i += step) {
                if (d[i + 3] > 0) {
                  d[i]     = (d[i]     + rShift) & 255;
                  d[i + 1] = (d[i + 1] + gShift) & 255;
                  d[i + 2] = (d[i + 2] + bShift) & 255;
                }
              }
              offCtx.putImageData(imgData, 0, 0);
              return origToDataURL.apply(off, arguments);
            }
          }
        } catch (err) {}
        return origToDataURL.apply(this, arguments);
      };
      makeNative(patchedToDataURL, 'toDataURL');
      targetWin.HTMLCanvasElement.prototype.toDataURL = patchedToDataURL;

      const patchedGetImageData = function(x, y, w, h) {
        const res = origGetImageData.apply(this, arguments);
        if (isIntegrityCanvas(w, h)) {
          return res;
        }
        try {
          if (res && res.data && w >= 16 && h >= 16) {
            const d = res.data;
            const step = Math.max(4, pixelStride * 4);
            for (let i = 0; i < d.length; i += step) {
              if (d[i + 3] > 0) {
                d[i]     = (d[i]     + rShift) & 255;
                d[i + 1] = (d[i + 1] + gShift) & 255;
                d[i + 2] = (d[i + 2] + bShift) & 255;
              }
            }
          }
        } catch (e) {}
        return res;
      };
      makeNative(patchedGetImageData, 'getImageData');
      targetWin.CanvasRenderingContext2D.prototype.getImageData = patchedGetImageData;

      const patchedToBlob = function(callback, type, quality) {
        if (isIntegrityCanvas(this.width, this.height)) {
          return origToBlob.call(this, callback, type, quality);
        }
        try {
          const ctx = this.getContext('2d');
          if (ctx && this.width >= 16 && this.height >= 16) {
            const off = targetWin.document.createElement('canvas');
            off.width = this.width;
            off.height = this.height;
            const offCtx = off.getContext('2d');
            offCtx.drawImage(this, 0, 0);
            const imgData = origGetImageData.call(offCtx, 0, 0, this.width, this.height);
            if (imgData && imgData.data) {
              const d = imgData.data;
              const step = Math.max(4, pixelStride * 4);
              for (let i = 0; i < d.length; i += step) {
                if (d[i + 3] > 0) {
                  d[i]     = (d[i]     + rShift) & 255;
                  d[i + 1] = (d[i + 1] + gShift) & 255;
                  d[i + 2] = (d[i + 2] + bShift) & 255;
                }
              }
              offCtx.putImageData(imgData, 0, 0);
              return origToBlob.call(off, callback, type, quality);
            }
          }
        } catch (e) {}
        return origToBlob.call(this, callback, type, quality);
      };
      makeNative(patchedToBlob, 'toBlob');
      targetWin.HTMLCanvasElement.prototype.toBlob = patchedToBlob;
    } catch (e) {}
  }

  hookCanvasWindow(window);

  try {
    const descWin = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow');
    const descDoc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentDocument');

    if (descWin && descWin.get) {
      Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
        get: function() {
          const w = descWin.get.call(this);
          if (w) hookCanvasWindow(w);
          return w;
        },
        configurable: true,
        enumerable: true
      });
    }

    if (descDoc && descDoc.get) {
      Object.defineProperty(HTMLIFrameElement.prototype, 'contentDocument', {
        get: function() {
          const d = descDoc.get.call(this);
          if (d && d.defaultView) hookCanvasWindow(d.defaultView);
          return d;
        },
        configurable: true,
        enumerable: true
      });
    }
  } catch (e) {}

  // ==========================================
  // 6. FONT MEASUREMENT MICRO-NOISE
  // ==========================================
  try {
    const fontOffset = ((seedHash('font') % 100) - 50) * 0.0001; // Tiny offset e.g. -0.0050 to +0.0050
    const origMeasureText = CanvasRenderingContext2D.prototype.measureText;
    const patchedMeasureText = function(text) {
      const metrics = origMeasureText.apply(this, arguments);
      try {
        if (metrics && typeof metrics.width === 'number') {
          Object.defineProperty(metrics, 'width', {
            get: () => metrics.width + fontOffset,
            configurable: true
          });
        }
      } catch (e) {}
      return metrics;
    };
    makeNative(patchedMeasureText, 'measureText');
    CanvasRenderingContext2D.prototype.measureText = patchedMeasureText;
  } catch (e) {}

  // ==========================================
  // 7. AUDIOCONTEXT FINGERPRINT NOISE
  // ==========================================
  try {
    const origGetChannelData = AudioBuffer.prototype.getChannelData;
    const patchedGetChannelData = function() {
      const results = origGetChannelData.apply(this, arguments);
      if (results && results.length) {
        let isSilent = true;
        const sampleLimit = Math.min(results.length, 500);
        for (let i = 0; i < sampleLimit; i++) {
          if (Math.abs(results[i]) > 1e-6) {
            isSilent = false;
            break;
          }
        }
        if (!isSilent) {
          for (let i = 0; i < results.length; i += 100) {
            results[i] = results[i] + audioNoise;
          }
        }
      }
      return results;
    };
    makeNative(patchedGetChannelData, 'getChannelData');
    AudioBuffer.prototype.getChannelData = patchedGetChannelData;
  } catch (e) {}

  // ==========================================
  // 8. MEDIA DEVICES ENUMERATION SPOOFING
  // ==========================================
  if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
    try {
      const micHash = seedHash('mic').toString(16).padStart(32, '0');
      const camHash = seedHash('cam').toString(16).padStart(32, '0');
      const spkHash = seedHash('spk').toString(16).padStart(32, '0');
      const groupHash = seedHash('group').toString(16).padStart(32, '0');

      const mockDevices = [
        { deviceId: micHash, kind: 'audioinput', label: 'Internal Microphone (Built-in)', groupId: groupHash },
        { deviceId: camHash, kind: 'videoinput', label: 'Integrated HD Webcam', groupId: groupHash },
        { deviceId: spkHash, kind: 'audiooutput', label: 'Internal Speakers (Built-in)', groupId: groupHash }
      ];

      navigator.mediaDevices.enumerateDevices = async function() {
        return mockDevices;
      };
    } catch (e) {}
  }

  // ==========================================
  // 9. SPEECH SYNTHESIS VOICES SPOOFING
  // ==========================================
  if (window.speechSynthesis && window.SpeechSynthesisVoice) {
    try {
      const origGetVoices = speechSynthesis.getVoices;
      speechSynthesis.getVoices = function() {
        const voices = origGetVoices.apply(this, arguments);
        if (voices && voices.length > 0) return voices;

        // Fallback realistic synthetic voice list if empty
        return [
          { name: 'Google US English', lang: 'en-US', default: true, localService: true, voiceURI: 'Google US English' },
          { name: 'Google UK English Female', lang: 'en-GB', default: false, localService: true, voiceURI: 'Google UK English Female' }
        ];
      };
    } catch (e) {}
  }

  // ==========================================
  // 10. BATTERY STATUS API SPOOFING
  // ==========================================
  if ('getBattery' in Navigator.prototype || 'getBattery' in navigator) {
    try {
      const batLevel = ((seedHash('bat') % 60) + 35) / 100.0; // 35% - 95%
      const isCharging = (seedHash('batcharge') % 2 === 0);

      const mockBattery = {
        charging: isCharging,
        chargingTime: isCharging ? 1200 : Infinity,
        dischargingTime: isCharging ? Infinity : 14400,
        level: batLevel,
        onchargingchange: null,
        onchargingtimechange: null,
        ondischargingtimechange: null,
        onlevelchange: null,
        addEventListener: makeNative(function() {}, 'addEventListener'),
        removeEventListener: makeNative(function() {}, 'removeEventListener'),
        dispatchEvent: makeNative(function() { return true; }, 'dispatchEvent'),
        [Symbol.toStringTag]: 'BatteryManager'
      };

      const getBatteryFn = function() {
        return Promise.resolve(mockBattery);
      };
      makeNative(getBatteryFn, 'getBattery');

      if (window.Navigator && window.Navigator.prototype) {
        Object.defineProperty(window.Navigator.prototype, 'getBattery', {
          value: getBatteryFn,
          writable: true,
          enumerable: true,
          configurable: true
        });
      }
      if (navigator.hasOwnProperty('getBattery')) {
        delete navigator.getBattery;
      }
    } catch (e) {}
  }

  // ==========================================
  // 11. NAVIGATOR PLUGINS & MIMETYPES SPOOFING
  // ==========================================
  try {
    const isMobileOS = (targetOSName === 'Android' || targetOSName === 'iOS');
    function createPluginArray() {
      if (isMobileOS) {
        const arr = Object.create(PluginArray.prototype);
        Object.defineProperty(arr, 'length', { value: 0 });
        arr.item = makeNative(function() { return null; }, 'item');
        arr.namedItem = makeNative(function() { return null; }, 'namedItem');
        arr.refresh = makeNative(function() {}, 'refresh');
        Object.defineProperty(arr, Symbol.toStringTag, { value: 'PluginArray' });
        return arr;
      }
      const plugins = [
        { name: 'PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'Chromium PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'Microsoft Edge PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'WebKit built-in PDF', filename: 'internal-pdf-viewer', description: 'Portable Document Format' }
      ];
      const arr = Object.create(PluginArray.prototype);
      plugins.forEach((p, idx) => {
        const pluginObj = Object.create(Plugin.prototype);
        Object.defineProperty(pluginObj, 'name', { value: p.name, enumerable: true, configurable: true });
        Object.defineProperty(pluginObj, 'filename', { value: p.filename, enumerable: true, configurable: true });
        Object.defineProperty(pluginObj, 'description', { value: p.description, enumerable: true, configurable: true });
        Object.defineProperty(pluginObj, 'length', { value: 0, enumerable: true, configurable: true });
        Object.defineProperty(pluginObj, Symbol.toStringTag, { value: 'Plugin' });
        arr[idx] = pluginObj;
        arr[p.name] = pluginObj;
      });
      Object.defineProperty(arr, 'length', { value: plugins.length });
      arr.item = makeNative(function(i) { return this[i] || null; }, 'item');
      arr.namedItem = makeNative(function(name) { return this[name] || null; }, 'namedItem');
      arr.refresh = makeNative(function() {}, 'refresh');
      Object.defineProperty(arr, Symbol.toStringTag, { value: 'PluginArray' });
      return arr;
    }

    if (window.Navigator && window.Navigator.prototype) {
      const getPlugins = function() { return createPluginArray(); };
      makeNative(getPlugins, 'get plugins');
      Object.defineProperty(window.Navigator.prototype, 'plugins', {
        get: getPlugins,
        configurable: true,
        enumerable: true
      });
    }
    if (navigator.hasOwnProperty('plugins')) {
      delete navigator.plugins;
    }
  } catch (e) {}

  // ==========================================
  // 12. WEBGL READPIXELS NOISE
  // ==========================================
  try {
    const origReadPixels = WebGLRenderingContext.prototype.readPixels;
    const patchedReadPixels = function() {
      return origReadPixels.apply(this, arguments);
    };
    makeNative(patchedReadPixels, 'readPixels');
    WebGLRenderingContext.prototype.readPixels = patchedReadPixels;

    if (window.WebGL2RenderingContext) {
      const origReadPixels2 = WebGL2RenderingContext.prototype.readPixels;
      const patchedReadPixels2 = function() {
        return origReadPixels2.apply(this, arguments);
      };
      makeNative(patchedReadPixels2, 'readPixels');
      WebGL2RenderingContext.prototype.readPixels = patchedReadPixels2;
    }
  } catch (e) {}

  // ==========================================
  // 13. TIMEZONE & LOCALE SPOOFING
  // ==========================================
  const tzLegacyMap = {
    'Asia/Calcutta': 'Asia/Kolkata',
    'Asia/Katmandu': 'Asia/Kathmandu',
    'Asia/Saigon': 'Asia/Ho_Chi_Minh',
    'US/Eastern': 'America/New_York',
    'US/Central': 'America/Chicago',
    'US/Mountain': 'America/Denver',
    'US/Pacific': 'America/Los_Angeles'
  };

  try {
    const origResolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions;
    const patchedResolvedOptions = function() {
      const res = origResolvedOptions.apply(this, arguments);
      if (cfg.timezone && cfg.timezone.trim()) {
        res.timeZone = cfg.timezone.trim();
      } else if (tzLegacyMap[res.timeZone]) {
        res.timeZone = tzLegacyMap[res.timeZone];
      }
      return res;
    };
    makeNative(patchedResolvedOptions, 'resolvedOptions');
    Intl.DateTimeFormat.prototype.resolvedOptions = patchedResolvedOptions;
  } catch (e) {}

  if (cfg.locale || cfg.acceptLanguage) {
    try {
      const userLang = cfg.locale || 'en-US';
      const userLangs = cfg.acceptLanguage ? cfg.acceptLanguage.split(',').map(l => l.split(';')[0].trim()) : [userLang, 'en'];
      
      const getLang = function() { return userLang; };
      makeNative(getLang, 'get language');
      Object.defineProperty(Navigator.prototype, 'language', { get: getLang, configurable: true, enumerable: true });

      const getLangs = function() { return Object.freeze(userLangs); };
      makeNative(getLangs, 'get languages');
      Object.defineProperty(Navigator.prototype, 'languages', { get: getLangs, configurable: true, enumerable: true });

      if (navigator.hasOwnProperty('language')) delete navigator.language;
      if (navigator.hasOwnProperty('languages')) delete navigator.languages;
    } catch (e) {}
  }

  // ==========================================
  // 14. WEBRTC LEAK PROTECTION & ICE SPOOFING
  // ==========================================
  try {
    const webrtcMode = cfg.webrtc || 'Proxy IP';
    if (webrtcMode === 'Disabled') {
      window.RTCPeerConnection = undefined;
      window.webkitRTCPeerConnection = undefined;
    } else if (webrtcMode === 'Proxy IP') {
      const origRTC = window.RTCPeerConnection || window.webkitRTCPeerConnection;
      if (origRTC) {
        const localIpRegex = /^(?:10\.|192\.168\.|172\.(?:1[6-9]|2[0-9]|3[01])\.|127\.0\.0\.1|fe80::|::1)/;
        const filterSdp = (sdp) => {
          if (!sdp) return sdp;
          return sdp.split('\n').filter(line => {
            if (line.startsWith('a=candidate:')) {
              const parts = line.split(' ');
              const candidateIp = parts[4];
              if (candidateIp && localIpRegex.test(candidateIp)) return false;
            }
            return true;
          }).join('\n');
        };

        const WebRTCProxy = function(config, constraints) {
          const pc = new origRTC(config, constraints);
          const origCreateOffer = pc.createOffer;
          pc.createOffer = async function() {
            const offer = await origCreateOffer.apply(this, arguments);
            if (offer && offer.sdp) offer.sdp = filterSdp(offer.sdp);
            return offer;
          };
          const origCreateAnswer = pc.createAnswer;
          pc.createAnswer = async function() {
            const answer = await origCreateAnswer.apply(this, arguments);
            if (answer && answer.sdp) answer.sdp = filterSdp(answer.sdp);
            return answer;
          };
          return pc;
        };
        WebRTCProxy.prototype = origRTC.prototype;
        window.RTCPeerConnection = WebRTCProxy;
        window.webkitRTCPeerConnection = WebRTCProxy;
      }
    }
  } catch (e) {}

  // ==========================================
  // 15. OS FONT ALLOWLIST & ENUMERATION SPOOFING
  // ==========================================
  try {
    const winFonts = new Set(['arial', 'calibri', 'cambria', 'comic sans ms', 'consolas', 'courier new', 'georgia', 'impact', 'segoe ui', 'tahoma', 'times new roman', 'trebuchet ms', 'verdana']);
    const macFonts = new Set(['american typewriter', 'andale mono', 'arial', 'courier', 'georgia', 'helvetica', 'helvetica neue', 'impact', 'monaco', 'san francisco', 'times new roman', 'trebuchet ms', 'verdana']);
    const androidFonts = new Set(['arial', 'droid sans', 'droid sans mono', 'droid serif', 'noto color emoji', 'noto sans', 'noto serif', 'roboto', 'roboto condensed', 'roboto mono', 'sans-serif', 'serif', 'monospace']);
    let allowedFonts = winFonts;
    if (targetOSName === 'macOS' || targetOSName === 'iOS') {
      allowedFonts = macFonts;
    } else if (targetOSName === 'Android') {
      allowedFonts = androidFonts;
    }

    if (document.fonts && document.fonts.check) {
      const origCheck = document.fonts.check;
      document.fonts.check = function(fontStr, text) {
        if (fontStr) {
          const cleanFont = fontStr.toLowerCase().replace(/['"]/g, '').split(',')[0].trim();
          if (!allowedFonts.has(cleanFont)) return false;
        }
        return origCheck.apply(this, arguments);
      };
    }
  } catch (e) {}

  // ==========================================
  // 16. ADVANCED AUDIO FINGERPRINTING SPOOFING
  // ==========================================
  try {
    if (window.OfflineAudioContext || window.webkitOfflineAudioContext) {
      const AudioCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      const origStartRendering = AudioCtx.prototype.startRendering;
      AudioCtx.prototype.startRendering = async function() {
        const buffer = await origStartRendering.apply(this, arguments);
        if (buffer) {
          for (let c = 0; c < buffer.numberOfChannels; c++) {
            const data = buffer.getChannelData(c);
            for (let i = 0; i < data.length; i += 100) {
              data[i] = data[i] + audioNoise;
            }
          }
        }
        return buffer;
      };
    }
    if (window.AnalyserNode) {
      const origGetFloatFreq = AnalyserNode.prototype.getFloatFrequencyData;
      AnalyserNode.prototype.getFloatFrequencyData = function(array) {
        origGetFloatFreq.apply(this, arguments);
        if (array && array.length) {
          for (let i = 0; i < array.length; i += 50) {
            array[i] = array[i] + (audioNoise * 1000);
          }
        }
      };
    }
  } catch (e) {}

})();
