// OmniShield Anti-Detect Engine v3.0 (GoLogin/Multilogin Spec Anti-Fingerprinting)
// Covers: Canvas, WebGL parameters & extensions, AudioContext, Media Devices, Font Metrics,
// Speech Synthesis, Battery API, Screen & Orientation, Navigator Plugins, and WebRTC.
(function() {
  const cfg = Object.assign({},
    (typeof window !== 'undefined' && (window.__omni_tmp_cfg__ || window.__OMNI_CONFIG)) ||
    (typeof self !== 'undefined' && (self.__omni_tmp_cfg__ || self.__OMNI_CONFIG)) ||
    {}
  );
  try {
    if (typeof window !== 'undefined') {
      delete window.__omni_tmp_cfg__;
      delete window.__OMNI_CONFIG;
    }
    if (typeof self !== 'undefined') {
      delete self.__omni_tmp_cfg__;
      delete self.__OMNI_CONFIG;
    }
  } catch(e) {}

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

  // Anti-Detection: Native Function.prototype.toString disguise (Akamai & CreepJS Spec)
  const nativeFnToString = Function.prototype.toString;
  const nativeMap = new WeakMap();

  function makeNative(fn, name, isConstructor = false) {
    const cleanName = name || fn.name || '';
    if (name) {
      try { Object.defineProperty(fn, 'name', { value: name, configurable: true }); } catch(e) {}
    }
    if (isConstructor || (fn.prototype && typeof fn.prototype === 'object' && fn.prototype.constructor === fn && Object.keys(fn.prototype).length > 0)) {
      nativeMap.set(fn, cleanName);
      return fn;
    }
    // Method shorthand generates functions without .prototype, matching native V8 methods and getters
    const wrapper = {
      [cleanName](...args) {
        return fn.apply(this, args);
      }
    }[cleanName];
    try { Object.defineProperty(wrapper, 'length', { value: fn.length, configurable: true }); } catch(e) {}
    nativeMap.set(wrapper, cleanName);
    nativeMap.set(fn, cleanName);
    return wrapper;
  }

  try {
    const patchedToString = {
      toString() {
        if (typeof this !== 'function') {
          return nativeFnToString.call(this);
        }
        if (nativeMap.has(this)) {
          const n = nativeMap.get(this);
          return `function ${n}() { [native code] }`;
        }
        return nativeFnToString.call(this);
      }
    }.toString;
    nativeMap.set(patchedToString, 'toString');
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
    targetArch = (webglRenderer.includes('Apple') || webglVendor.includes('Apple')) ? 'arm' : 'x86';
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
  } else if (ua.includes('Linux') || ua.includes('X11')) {
    targetPlatform = 'Linux x86_64';
    targetOSName = 'Linux';
    targetPlatformVersion = '6.5.0';
    targetArch = 'x86';
    targetModel = '';
    isMobile = false;
  }

  const userLang = cfg.locale || 'en-US';
  const userLangs = cfg.acceptLanguage 
    ? cfg.acceptLanguage.split(',').map(l => l.split(';')[0].trim()).filter(Boolean) 
    : [userLang, 'en'];
  if (!userLangs.includes(userLang)) userLangs.unshift(userLang);

  // ==========================================
  // 1. AUTOMATION DETECTION STRIPPING
  // ==========================================
  try {
    if (navigator.hasOwnProperty('webdriver')) delete navigator.webdriver;
    if (window.Navigator && window.Navigator.prototype) {
      let getWd = function() { return false; };
      getWd = makeNative(getWd, 'get webdriver');
      Object.defineProperty(window.Navigator.prototype, 'webdriver', {
        get: getWd,
        set: undefined,
        configurable: true,
        enumerable: true
      });
    }
    const autoGlobals = [
      '__playwright', '__puppeteer_evaluation_script__',
      '$cdc_asdjflasutopfhvcZLmcfl_', '$chrome_asyncScriptInfo',
      'domAutomation', 'domAutomationController'
    ];
    for (const g of autoGlobals) {
      try {
        if (typeof window !== 'undefined' && g in window) {
          delete window[g];
        }
      } catch(e) {}
    }
  } catch (e) {}

  // ==========================================
  // 2. NAVIGATOR & PLATFORM SPOOFING (PROTOTYPE-ONLY DISGUISE)
  // ==========================================
  try {
    const clampedMemoryGb = (memoryGb >= 8) ? 8 : ((memoryGb >= 4) ? 4 : ((memoryGb >= 2) ? 2 : 1));
    const navProps = {
      platform: targetPlatform,
      hardwareConcurrency: cpuCores,
      deviceMemory: clampedMemoryGb,
      language: userLang,
      languages: Object.freeze(userLangs),
      userAgent: ua,
      appVersion: ua.replace(/^Mozilla\//, ''),
      vendor: (targetOSName === 'iOS') ? 'Apple Computer, Inc.' : 'Google Inc.',
      maxTouchPoints: (targetOSName === 'Android' || targetOSName === 'iOS') ? 5 : 0,
      pdfViewerEnabled: (targetOSName === 'Android' || targetOSName === 'iOS') ? false : true
    };

    if (targetOSName === 'iOS') {
      try {
        if ('connection' in Navigator.prototype) delete Navigator.prototype.connection;
        if ('connection' in navigator) delete navigator.connection;
        if ('keyboard' in Navigator.prototype) delete Navigator.prototype.keyboard;
        if ('keyboard' in navigator) delete navigator.keyboard;
      } catch(e) {}
    }

    if (window.Navigator && window.Navigator.prototype) {
      for (const [p, v] of Object.entries(navProps)) {
        try {
          let getter = function() { return v; };
          getter = makeNative(getter, `get ${p}`);
          Object.defineProperty(window.Navigator.prototype, p, {
            get: getter,
            set: undefined,
            configurable: true,
            enumerable: true
          });
        } catch (e) {}
      }
    }

    const targetDpr = (targetOSName === 'macOS' || targetOSName === 'iOS') ? 2 : 1;
    try {
      let dprGetter = function() { return targetDpr; };
      dprGetter = makeNative(dprGetter, 'get devicePixelRatio');
      Object.defineProperty(window, 'devicePixelRatio', {
        get: dprGetter,
        configurable: true
      });
    } catch(e) {}

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
          let patchedMatchMedia = function(query) {
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
          patchedMatchMedia = makeNative(patchedMatchMedia, 'matchMedia');
          window.matchMedia = patchedMatchMedia;
        }
      } catch (e) {}
    }
  } catch (e) {}

  // Client Hints (Sec-CH-UA)
  if (navigator.userAgentData || window.NavigatorUAData) {
    try {
      const chromeM = ua.match(/(?:Chrome|CriOS)\/(\d+)\.([\d.]+)/);
      const chromeMajor = chromeM ? chromeM[1] : '150';
      const chromeFull = chromeM ? `${chromeMajor}.${chromeM[2]}` : '150.0.0.0';

      const brands = Object.freeze([
        Object.freeze({ brand: 'Chromium', version: chromeMajor }),
        Object.freeze({ brand: 'Google Chrome', version: chromeMajor }),
        Object.freeze({ brand: 'Not_A Brand', version: '24' })
      ]);
      const highEntropy = {
        architecture: targetArch,
        bitness: '64',
        brands: Object.freeze([
          Object.freeze({ brand: 'Chromium', version: chromeFull }),
          Object.freeze({ brand: 'Google Chrome', version: chromeFull }),
          Object.freeze({ brand: 'Not_A Brand', version: '24.0.0.0' })
        ]),
        fullVersionList: Object.freeze([
          Object.freeze({ brand: 'Chromium', version: chromeFull }),
          Object.freeze({ brand: 'Google Chrome', version: chromeFull }),
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
        mockUAData.toJSON = makeNative(function() {
          return {
            brands: brands,
            mobile: isMobile,
            platform: targetOSName
          };
        }, 'toJSON');
        Object.defineProperty(mockUAData, Symbol.toStringTag, { value: 'NavigatorUAData' });

        if (window.Navigator && window.Navigator.prototype) {
          let getUAData = function() { return mockUAData; };
          getUAData = makeNative(getUAData, 'get userAgentData');
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

    function makeScreenGetter(prop, val) {
      let g = function() { return val; };
      g = makeNative(g, `get ${prop}`);
      return { get: g, configurable: true, enumerable: true };
    }

    const screenDescriptors = {
      width: makeScreenGetter('width', targetW),
      height: makeScreenGetter('height', targetH),
      availWidth: makeScreenGetter('availWidth', targetW),
      availHeight: makeScreenGetter('availHeight', targetH - 40),
      colorDepth: makeScreenGetter('colorDepth', colDepth),
      pixelDepth: makeScreenGetter('pixelDepth', colDepth),
      availLeft: makeScreenGetter('availLeft', 0),
      availTop: makeScreenGetter('availTop', 0)
    };

    if (window.Screen && window.Screen.prototype) {
      try { Object.defineProperties(window.Screen.prototype, screenDescriptors); } catch (e) {}
    }

    // Override inner/outer window dimensions and DPR on window (responsive to automation resizing)
    try {
      if (typeof window.innerWidth === 'number' && window.innerWidth === 0) {
        let getInnerW = function() { return window.innerWidth || targetW; };
        getInnerW = makeNative(getInnerW, 'get innerWidth');
        Object.defineProperty(window, 'innerWidth', { get: getInnerW, configurable: true });

        let getInnerH = function() { return window.innerHeight || (targetH - 85); };
        getInnerH = makeNative(getInnerH, 'get innerHeight');
        Object.defineProperty(window, 'innerHeight', { get: getInnerH, configurable: true });

        let getOuterW = function() { return window.outerWidth || targetW; };
        getOuterW = makeNative(getOuterW, 'get outerWidth');
        Object.defineProperty(window, 'outerWidth', { get: getOuterW, configurable: true });

        let getOuterH = function() { return window.outerHeight || (targetH - 40); };
        getOuterH = makeNative(getOuterH, 'get outerHeight');
        Object.defineProperty(window, 'outerHeight', { get: getOuterH, configurable: true });
      }

      const dprVal = (targetOSName === 'macOS' || targetOSName === 'iOS') ? 2 : 1;
      let getDpr = function() { return dprVal; };
      getDpr = makeNative(getDpr, 'get devicePixelRatio');
      Object.defineProperty(window, 'devicePixelRatio', { get: getDpr, configurable: true });
    } catch (e) {}

    const orientType = isMobile ? 'portrait-primary' : 'landscape-primary';
    const orientAngle = 0;

    if (window.ScreenOrientation && window.ScreenOrientation.prototype) {
      try {
        let getOType = function() { return orientType; };
        getOType = makeNative(getOType, 'get type');
        Object.defineProperty(window.ScreenOrientation.prototype, 'type', {
          get: getOType,
          configurable: true,
          enumerable: true
        });

        let getOAngle = function() { return orientAngle; };
        getOAngle = makeNative(getOAngle, 'get angle');
        Object.defineProperty(window.ScreenOrientation.prototype, 'angle', {
          get: getOAngle,
          configurable: true,
          enumerable: true
        });
      } catch(e) {}
    }
    if (screen.orientation) {
      try {
        if (screen.orientation.hasOwnProperty('type')) delete screen.orientation.type;
        if (screen.orientation.hasOwnProperty('angle')) delete screen.orientation.angle;
      } catch(e) {}
    }
  } catch (e) {}

  // ==========================================
  // 4. MEDIA DEVICES & GEOLOCATION MOCKING
  // ==========================================
  try {
    const isMacDev = targetOSName === 'macOS';
    const micLabel = isMacDev ? 'MacBook Pro Microphone (Built-in)' : 'Microphone (Realtek(R) Audio)';
    const speakerLabel = isMacDev ? 'MacBook Pro Speakers (Built-in)' : 'Speakers (Realtek(R) Audio)';
    const camLabel = isMacDev ? 'FaceTime HD Camera' : 'Integrated HD Webcam (04f2:b6d9)';
    const fakeDevs = [
      { deviceId: 'default', kind: 'audioinput', label: micLabel, groupId: 'group-default' },
      { deviceId: 'audio-in-1', kind: 'audioinput', label: micLabel, groupId: 'group-1' },
      { deviceId: 'default', kind: 'audiooutput', label: speakerLabel, groupId: 'group-default' },
      { deviceId: 'audio-out-1', kind: 'audiooutput', label: speakerLabel, groupId: 'group-1' },
      { deviceId: 'video-in-1', kind: 'videoinput', label: camLabel, groupId: 'group-cam' }
    ];

    if (window.MediaDevices && window.MediaDevices.prototype && window.MediaDevices.prototype.enumerateDevices) {
      let patchedEnumerate = async function() {
        return fakeDevs.map(d => Object.assign(Object.create(window.MediaDeviceInfo ? window.MediaDeviceInfo.prototype : Object.prototype), d));
      };
      patchedEnumerate = makeNative(patchedEnumerate, 'enumerateDevices');
      window.MediaDevices.prototype.enumerateDevices = patchedEnumerate;
      if (navigator.mediaDevices && navigator.mediaDevices.hasOwnProperty('enumerateDevices')) {
        delete navigator.mediaDevices.enumerateDevices;
      }
    }
  } catch (e) {}

  try {
    const proxyLat = (cfg.proxy && cfg.proxy.lat) || cfg.lat || null;
    const proxyLng = (cfg.proxy && cfg.proxy.lng) || cfg.lng || null;
    if (proxyLat !== null && proxyLng !== null && window.Geolocation && window.Geolocation.prototype) {
      const fakePos = {
        coords: {
          latitude: Number(proxyLat),
          longitude: Number(proxyLng),
          accuracy: 25.0,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null
        },
        timestamp: Date.now()
      };
      let patchedGetPos = function(success) {
        if (typeof success === 'function') setTimeout(() => success(fakePos), 10);
      };
      patchedGetPos = makeNative(patchedGetPos, 'getCurrentPosition');
      window.Geolocation.prototype.getCurrentPosition = patchedGetPos;

      let patchedWatchPos = function(success) {
        if (typeof success === 'function') setTimeout(() => success(fakePos), 10);
        return 1;
      };
      patchedWatchPos = makeNative(patchedWatchPos, 'watchPosition');
      window.Geolocation.prototype.watchPosition = patchedWatchPos;

      if (navigator.geolocation) {
        if (navigator.geolocation.hasOwnProperty('getCurrentPosition')) delete navigator.geolocation.getCurrentPosition;
        if (navigator.geolocation.hasOwnProperty('watchPosition')) delete navigator.geolocation.watchPosition;
      }
    }
  } catch (e) {}

  // Document Focus & Visibility Alignment (prototype-only to prevent detection)
  try {
    if (typeof Document !== 'undefined' && Document.prototype) {
      if (Document.prototype.hasFocus) {
        Document.prototype.hasFocus = makeNative(function() { return true; }, 'hasFocus');
      }
      if ('hidden' in Document.prototype) {
        Object.defineProperty(Document.prototype, 'hidden', {
          get: makeNative(function() { return false; }, 'get hidden'),
          configurable: true,
          enumerable: true
        });
      }
      if ('visibilityState' in Document.prototype) {
        Object.defineProperty(Document.prototype, 'visibilityState', {
          get: makeNative(function() { return 'visible'; }, 'get visibilityState'),
          configurable: true,
          enumerable: true
        });
      }
    }
    if (typeof document !== 'undefined') {
      if (document.hasOwnProperty('hasFocus')) delete document.hasFocus;
      if (document.hasOwnProperty('hidden')) delete document.hidden;
      if (document.hasOwnProperty('visibilityState')) delete document.visibilityState;
    }
  } catch(e) {}

  // Event isTrusted & Synthetic Event Disguise (Akamai Heuristic Defense)
  try {
    if (typeof EventTarget !== 'undefined' && EventTarget.prototype.dispatchEvent) {
      const origDispatch = EventTarget.prototype.dispatchEvent;
      let patchedDispatch = function(event) {
        if (event && !event.isTrusted) {
          try {
            Object.defineProperty(event, 'isTrusted', { value: true, configurable: true });
          } catch(e) {}
        }
        return origDispatch.apply(this, arguments);
      };
      patchedDispatch = makeNative(patchedDispatch, 'dispatchEvent');
      EventTarget.prototype.dispatchEvent = patchedDispatch;
    }
  } catch(e) {}

  // ==========================================
  // 5. WEBGL VENDOR, RENDERER & PARAMETERS
  // ==========================================
  try {
    const isMobileGPU = isMobile || targetOSName === 'Android' || targetOSName === 'iOS';
    const maxTexSize = isMobileGPU ? 8192 : 16384;
    const maxRenderSize = isMobileGPU ? 8192 : 16384;
    const maxViewportDims = new Int32Array([maxTexSize, maxTexSize]);

    const getParamOrig = WebGLRenderingContext.prototype.getParameter;
    let patchedGetParam = function(param) {
      const res = getParamOrig.apply(this, arguments);
      if (param === 37445) return webglVendor;       // UNMASKED_VENDOR_WEBGL
      if (param === 37446) return webglRenderer;     // UNMASKED_RENDERER_WEBGL
      if (param === 3379)  return maxTexSize;        // MAX_TEXTURE_SIZE
      if (param === 34024) return maxRenderSize;     // MAX_RENDERBUFFER_SIZE
      if (param === 3386)  return maxViewportDims;   // MAX_VIEWPORT_DIMS
      return res;
    };
    patchedGetParam = makeNative(patchedGetParam, 'getParameter');
    WebGLRenderingContext.prototype.getParameter = patchedGetParam;

    if (window.WebGL2RenderingContext) {
      const getParamOrig2 = WebGL2RenderingContext.prototype.getParameter;
      let patchedGetParam2 = function(param) {
        const res = getParamOrig2.apply(this, arguments);
        if (param === 37445) return webglVendor;
        if (param === 37446) return webglRenderer;
        if (param === 3379)  return maxTexSize;
        if (param === 34024) return maxRenderSize;
        if (param === 3386)  return maxViewportDims;
        return res;
      };
      patchedGetParam2 = makeNative(patchedGetParam2, 'getParameter');
      WebGL2RenderingContext.prototype.getParameter = patchedGetParam2;
    }

    const DESKTOP_ONLY_EXT = ['WEBGL_compressed_texture_s3tc', 'WEBGL_compressed_texture_s3tc_srgb', 'EXT_texture_compression_bptc', 'EXT_texture_compression_rgtc'];
    const MOBILE_ONLY_EXT = ['WEBGL_compressed_texture_etc', 'WEBGL_compressed_texture_etc1', 'WEBGL_compressed_texture_astc', 'WEBGL_compressed_texture_pvrtc'];

    const patchExtensions = (proto) => {
      const origGetSupported = proto.getSupportedExtensions;
      const origGetExtension = proto.getExtension;
      if (origGetSupported) {
        let patchedGetSupported = function() {
          let list = origGetSupported.apply(this, arguments) || [];
          list = isMobileGPU
            ? list.filter((e) => !DESKTOP_ONLY_EXT.includes(e))
            : list.filter((e) => !MOBILE_ONLY_EXT.includes(e));
          return list;
        };
        patchedGetSupported = makeNative(patchedGetSupported, 'getSupportedExtensions');
        proto.getSupportedExtensions = patchedGetSupported;
      }
      if (origGetExtension) {
        let patchedGetExtension = function(name) {
          if (name === 'WEBGL_debug_renderer_info') {
            return {
              UNMASKED_VENDOR_WEBGL: 37445,
              UNMASKED_RENDERER_WEBGL: 37446
            };
          }
          if (isMobileGPU && DESKTOP_ONLY_EXT.includes(name)) return null;
          if (!isMobileGPU && MOBILE_ONLY_EXT.includes(name)) return null;
          return origGetExtension.apply(this, arguments);
        };
        patchedGetExtension = makeNative(patchedGetExtension, 'getExtension');
        proto.getExtension = patchedGetExtension;
      }
    };
    patchExtensions(WebGLRenderingContext.prototype);
    if (window.WebGL2RenderingContext) patchExtensions(WebGL2RenderingContext.prototype);

    const patchShaderPrecision = (proto) => {
      const origGetShaderPrecision = proto.getShaderPrecisionFormat;
      if (origGetShaderPrecision) {
        let patchedGetShaderPrecision = function(shaderType, precisionType) {
          const res = origGetShaderPrecision.apply(this, arguments);
          if (res && !isMobileGPU && res.precision < 23) {
            const fakePrecision = {
              rangeMin: 127,
              rangeMax: 127,
              precision: 23,
              [Symbol.toStringTag]: 'WebGLShaderPrecisionFormat'
            };
            if (window.WebGLShaderPrecisionFormat && window.WebGLShaderPrecisionFormat.prototype) {
              Object.setPrototypeOf(fakePrecision, window.WebGLShaderPrecisionFormat.prototype);
            }
            return fakePrecision;
          }
          return res;
        };
        patchedGetShaderPrecision = makeNative(patchedGetShaderPrecision, 'getShaderPrecisionFormat');
        proto.getShaderPrecisionFormat = patchedGetShaderPrecision;
      }
    };
    patchShaderPrecision(WebGLRenderingContext.prototype);
    if (window.WebGL2RenderingContext) patchShaderPrecision(WebGL2RenderingContext.prototype);
  } catch (e) {}

  // ==========================================
  // 5. CANVAS 2D NOISE INJECTION (TOP WINDOW & IFRAME RECURSIVE)
  // ==========================================
  function isIntegrityCanvas(w, h) {
    return (w === 21 && h === 120) || (w === 240 && h === 60);
  }

  const hookedWins = new WeakSet();

  function hookCanvasWindow(targetWin) {
    if (!targetWin || typeof targetWin !== 'object' || hookedWins.has(targetWin)) return;
    try { hookedWins.add(targetWin); } catch(e) {}

    try {
      if (!targetWin.HTMLCanvasElement || !targetWin.CanvasRenderingContext2D) return;
      const origToDataURL = targetWin.HTMLCanvasElement.prototype.toDataURL;
      const origGetImageData = targetWin.CanvasRenderingContext2D.prototype.getImageData;
      const origToBlob = targetWin.HTMLCanvasElement.prototype.toBlob;
      let origIsPointInPath = targetWin.CanvasRenderingContext2D.prototype.isPointInPath;
      origIsPointInPath = makeNative(origIsPointInPath, 'isPointInPath');

      const canvasContextMap = new WeakMap();
      if (targetWin.HTMLCanvasElement.prototype.getContext) {
        const origGetCtx = targetWin.HTMLCanvasElement.prototype.getContext;
        let patchedGetCtx = function(type) {
          const res = origGetCtx.apply(this, arguments);
          if (res && typeof type === 'string') {
            canvasContextMap.set(this, type.toLowerCase());
          }
          return res;
        };
        patchedGetCtx = makeNative(patchedGetCtx, 'getContext');
        targetWin.HTMLCanvasElement.prototype.getContext = patchedGetCtx;
      }

      const rDelta = (rShift >= -1 && rShift <= 1) ? rShift : ((rShift % 3) - 1);
      const gDelta = (gShift >= -1 && gShift <= 1) ? gShift : ((gShift % 3) - 1);
      const bDelta = (bShift >= -1 && bShift <= 1) ? bShift : ((bShift % 3) - 1);

      function applyCanvasNoise(d) {
        if (!d || !d.length) return;
        const step = Math.max(4, pixelStride * 4);
        for (let i = 0; i < d.length; i += step) {
          if (d[i + 3] > 0) {
            d[i]     = Math.max(0, Math.min(255, d[i]     + rDelta));
            d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + gDelta));
            d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + bDelta));
          }
        }
      }

      function isFingerprintCanvas(canvas, w, h) {
        if (isIntegrityCanvas(w, h)) return false;
        if (!canvas) return true;
        try {
          const id = (canvas.id || '').toLowerCase();
          const cls = (canvas.className || '').toLowerCase();
          if (id.includes('captcha') || cls.includes('captcha') || id.includes('cimage') || id.includes('captcha-img')) {
            return false;
          }
          // Connected canvases are visible functional UI elements (e.g. Captchas, signatures, charts)
          // Anti-bot fingerprinters (CreepJS, BrowserLeaks, Akamai) always measure offscreen/detached canvases
          if (canvas.isConnected) {
            return false;
          }
        } catch (e) {}
        return true;
      }

      let patchedToDataURL = function() {
        if (!isFingerprintCanvas(this, this.width, this.height)) {
          return origToDataURL.apply(this, arguments);
        }
        try {
          const ctxType = canvasContextMap.get(this);
          if (this.width >= 16 && this.height >= 16) {
            if (ctxType === '2d') {
              const ctx = this.getContext('2d');
              if (ctx) {
                const imgData = origGetImageData.call(ctx, 0, 0, this.width, this.height);
                if (imgData && imgData.data) {
                  applyCanvasNoise(imgData.data);
                  ctx.putImageData(imgData, 0, 0);
                }
              }
            } else if (ctxType && ctxType.includes('webgl')) {
              const off = targetWin.document.createElement('canvas');
              off.width = this.width;
              off.height = this.height;
              const offCtx = off.getContext('2d');
              offCtx.drawImage(this, 0, 0);
              const imgData = origGetImageData.call(offCtx, 0, 0, this.width, this.height);
              if (imgData && imgData.data) {
                applyCanvasNoise(imgData.data);
                offCtx.putImageData(imgData, 0, 0);
                return origToDataURL.apply(off, arguments);
              }
            }
          }
        } catch (err) {}
        return origToDataURL.apply(this, arguments);
      };
      patchedToDataURL = makeNative(patchedToDataURL, 'toDataURL');
      targetWin.HTMLCanvasElement.prototype.toDataURL = patchedToDataURL;

      let patchedGetImageData = function(x, y, w, h) {
        const res = origGetImageData.apply(this, arguments);
        const canvasEl = this.canvas;
        if (!isFingerprintCanvas(canvasEl, w, h)) {
          return res;
        }
        try {
          if (res && res.data && w >= 16 && h >= 16) {
            applyCanvasNoise(res.data);
          }
        } catch (e) {}
        return res;
      };
      patchedGetImageData = makeNative(patchedGetImageData, 'getImageData');
      targetWin.CanvasRenderingContext2D.prototype.getImageData = patchedGetImageData;

      let patchedToBlob = function(callback, type, quality) {
        if (!isFingerprintCanvas(this, this.width, this.height)) {
          return origToBlob.call(this, callback, type, quality);
        }
        try {
          const ctxType = canvasContextMap.get(this);
          if (this.width >= 16 && this.height >= 16) {
            if (ctxType === '2d') {
              const ctx = this.getContext('2d');
              if (ctx) {
                const imgData = origGetImageData.call(ctx, 0, 0, this.width, this.height);
                if (imgData && imgData.data) {
                  applyCanvasNoise(imgData.data);
                  ctx.putImageData(imgData, 0, 0);
                }
              }
            } else if (ctxType && ctxType.includes('webgl')) {
              const off = targetWin.document.createElement('canvas');
              off.width = this.width;
              off.height = this.height;
              const offCtx = off.getContext('2d');
              offCtx.drawImage(this, 0, 0);
              const imgData = origGetImageData.call(offCtx, 0, 0, this.width, this.height);
              if (imgData && imgData.data) {
                applyCanvasNoise(imgData.data);
                offCtx.putImageData(imgData, 0, 0);
                return origToBlob.call(off, callback, type, quality);
              }
            }
          }
        } catch (e) {}
        return origToBlob.call(this, callback, type, quality);
      };
      patchedToBlob = makeNative(patchedToBlob, 'toBlob');
      targetWin.HTMLCanvasElement.prototype.toBlob = patchedToBlob;

      // OffscreenCanvas & OffscreenCanvasRenderingContext2D Hooking
      if (targetWin.OffscreenCanvas && targetWin.OffscreenCanvas.prototype.convertToBlob) {
        const origConvertToBlob = targetWin.OffscreenCanvas.prototype.convertToBlob;
        let patchedConvertToBlob = async function(options) {
          if (isIntegrityCanvas(this.width, this.height)) {
            return origConvertToBlob.apply(this, arguments);
          }
          try {
            if (this.width >= 16 && this.height >= 16) {
              const ctxType = canvasContextMap.get(this);
              if (ctxType === '2d') {
                const ctx = this.getContext('2d');
                if (ctx && targetWin.OffscreenCanvasRenderingContext2D) {
                  const imgData = targetWin.OffscreenCanvasRenderingContext2D.prototype.getImageData.call(ctx, 0, 0, this.width, this.height);
                  if (imgData && imgData.data) {
                    applyCanvasNoise(imgData.data);
                    ctx.putImageData(imgData, 0, 0);
                  }
                }
              } else if (ctxType && ctxType.includes('webgl')) {
                const off = new targetWin.OffscreenCanvas(this.width, this.height);
                const offCtx = off.getContext('2d');
                offCtx.drawImage(this, 0, 0);
                const imgData = offCtx.getImageData(0, 0, this.width, this.height);
                if (imgData && imgData.data) {
                  applyCanvasNoise(imgData.data);
                  offCtx.putImageData(imgData, 0, 0);
                  return origConvertToBlob.call(off, options);
                }
              }
            }
          } catch(e) {}
          return origConvertToBlob.apply(this, arguments);
        };
        patchedConvertToBlob = makeNative(patchedConvertToBlob, 'convertToBlob');
        targetWin.OffscreenCanvas.prototype.convertToBlob = patchedConvertToBlob;
      }

      if (targetWin.OffscreenCanvasRenderingContext2D && targetWin.OffscreenCanvasRenderingContext2D.prototype.getImageData) {
        const origOffGetImageData = targetWin.OffscreenCanvasRenderingContext2D.prototype.getImageData;
        let patchedOffGetImageData = function(x, y, w, h) {
          const res = origOffGetImageData.apply(this, arguments);
          if (isIntegrityCanvas(w, h)) return res;
          try {
            if (res && res.data && w >= 16 && h >= 16) {
              applyCanvasNoise(res.data);
            }
          } catch(e) {}
          return res;
        };
        patchedOffGetImageData = makeNative(patchedOffGetImageData, 'getImageData');
        targetWin.OffscreenCanvasRenderingContext2D.prototype.getImageData = patchedOffGetImageData;
      }

      // Path-tracing rasterization micro-jitter (isPointInPath & isPointInStroke)
      const pointJitter = ((seedHash('canvas_point') % 5) - 2) * 0.00005;
      if (targetWin.CanvasRenderingContext2D && targetWin.CanvasRenderingContext2D.prototype.isPointInPath) {
        const origIsPoint = targetWin.CanvasRenderingContext2D.prototype.isPointInPath;
        let patchedIsPoint = function(a, b, c, d) {
          if (typeof a === 'number' && typeof b === 'number') {
            return origIsPoint.call(this, a + pointJitter, b + pointJitter, c);
          } else if (a instanceof Path2D && typeof b === 'number' && typeof c === 'number') {
            return origIsPoint.call(this, a, b + pointJitter, c + pointJitter, d);
          }
          return origIsPoint.apply(this, arguments);
        };
        patchedIsPoint = makeNative(patchedIsPoint, 'isPointInPath');
        targetWin.CanvasRenderingContext2D.prototype.isPointInPath = patchedIsPoint;

        const origIsStroke = targetWin.CanvasRenderingContext2D.prototype.isPointInStroke;
        let patchedIsStroke = function(a, b, c, d) {
          if (typeof a === 'number' && typeof b === 'number') {
            return origIsStroke.call(this, a + pointJitter, b + pointJitter, c);
          } else if (a instanceof Path2D && typeof b === 'number' && typeof c === 'number') {
            return origIsStroke.call(this, a, b + pointJitter, c + pointJitter, d);
          }
          return origIsStroke.apply(this, arguments);
        };
        patchedIsStroke = makeNative(patchedIsStroke, 'isPointInStroke');
        targetWin.CanvasRenderingContext2D.prototype.isPointInStroke = patchedIsStroke;
      }

      if (targetWin.OffscreenCanvasRenderingContext2D && targetWin.OffscreenCanvasRenderingContext2D.prototype.isPointInPath) {
        const origOffIsPoint = targetWin.OffscreenCanvasRenderingContext2D.prototype.isPointInPath;
        let patchedOffIsPoint = function(a, b, c, d) {
          if (typeof a === 'number' && typeof b === 'number') {
            return origOffIsPoint.call(this, a + pointJitter, b + pointJitter, c);
          } else if (a instanceof Path2D && typeof b === 'number' && typeof c === 'number') {
            return origOffIsPoint.call(this, a, b + pointJitter, c + pointJitter, d);
          }
          return origOffIsPoint.apply(this, arguments);
        };
        patchedOffIsPoint = makeNative(patchedOffIsPoint, 'isPointInPath');
        targetWin.OffscreenCanvasRenderingContext2D.prototype.isPointInPath = patchedOffIsPoint;
      }
    } catch (e) {}
  }

  hookCanvasWindow(window);

  try {
    const descWin = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow');
    const descDoc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentDocument');

    if (descWin && descWin.get) {
      const origWinGet = descWin.get;
      let patchedWinGet = function() {
        const w = origWinGet.call(this);
        if (w) hookCanvasWindow(w);
        return w;
      };
      patchedWinGet = makeNative(patchedWinGet, 'get contentWindow');
      Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
        get: patchedWinGet,
        configurable: true,
        enumerable: true
      });
    }

    if (descDoc && descDoc.get) {
      const origDocGet = descDoc.get;
      let patchedDocGet = function() {
        const d = origDocGet.call(this);
        if (d && d.defaultView) hookCanvasWindow(d.defaultView);
        return d;
      };
      patchedDocGet = makeNative(patchedDocGet, 'get contentDocument');
      Object.defineProperty(HTMLIFrameElement.prototype, 'contentDocument', {
        get: patchedDocGet,
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
    let patchedMeasureText = function(text) {
      const metrics = origMeasureText.apply(this, arguments);
      try {
        if (metrics && typeof metrics.width === 'number') {
          const origW = metrics.width;
          let getW = function() { return origW + fontOffset; };
          getW = makeNative(getW, 'get width');
          Object.defineProperty(metrics, 'width', {
            get: getW,
            configurable: true
          });
        }
      } catch (e) {}
      return metrics;
    };
    patchedMeasureText = makeNative(patchedMeasureText, 'measureText');
    CanvasRenderingContext2D.prototype.measureText = patchedMeasureText;
  } catch (e) {}

  // ==========================================
  // 7. AUDIOCONTEXT FINGERPRINT NOISE
  // ==========================================
  try {
    const origGetChannelData = AudioBuffer.prototype.getChannelData;
    let patchedGetChannelData = function() {
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
    patchedGetChannelData = makeNative(patchedGetChannelData, 'getChannelData');
    AudioBuffer.prototype.getChannelData = patchedGetChannelData;

    if (AudioBuffer.prototype.copyFromChannel) {
      const origCopy = AudioBuffer.prototype.copyFromChannel;
      let patchedCopy = function(destination, channelNumber, startInChannel) {
        origCopy.apply(this, arguments);
        if (destination && destination.length) {
          for (let i = 0; i < destination.length; i += 100) {
            destination[i] = destination[i] + audioNoise;
          }
        }
      };
      patchedCopy = makeNative(patchedCopy, 'copyFromChannel');
      AudioBuffer.prototype.copyFromChannel = patchedCopy;
    }
  } catch (e) {}

  // ==========================================
  // 8. SPEECH SYNTHESIS VOICES SPOOFING
  // ==========================================
  if (window.SpeechSynthesis && window.SpeechSynthesis.prototype && window.SpeechSynthesis.prototype.getVoices) {
    try {
      const origGetVoices = window.SpeechSynthesis.prototype.getVoices;
      let patchedGetVoices = function() {
        const voices = origGetVoices.apply(this, arguments);
        if (voices && voices.length > 0) return voices;

        // Fallback realistic synthetic voice list if empty (inheriting SpeechSynthesisVoice.prototype)
        const defaultVoices = [
          { name: 'Google US English', lang: 'en-US', default: true, localService: true, voiceURI: 'Google US English' },
          { name: 'Google UK English Female', lang: 'en-GB', default: false, localService: true, voiceURI: 'Google UK English Female' }
        ];
        if (window.SpeechSynthesisVoice && window.SpeechSynthesisVoice.prototype) {
          return defaultVoices.map(v => Object.assign(Object.create(window.SpeechSynthesisVoice.prototype), v));
        }
        return defaultVoices;
      };
      patchedGetVoices = makeNative(patchedGetVoices, 'getVoices');
      window.SpeechSynthesis.prototype.getVoices = patchedGetVoices;
      if (window.speechSynthesis && window.speechSynthesis.hasOwnProperty('getVoices')) {
        delete window.speechSynthesis.getVoices;
      }
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

      let getBatteryFn = function() {
        return Promise.resolve(mockBattery);
      };
      getBatteryFn = makeNative(getBatteryFn, 'getBattery');

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

    function buildPluginsAndMimes() {
      if (isMobileOS) {
        const pArr = Object.create(PluginArray.prototype);
        Object.defineProperty(pArr, 'length', { value: 0 });
        pArr.item = makeNative(function() { return null; }, 'item');
        pArr.namedItem = makeNative(function() { return null; }, 'namedItem');
        pArr.refresh = makeNative(function() {}, 'refresh');
        Object.defineProperty(pArr, Symbol.toStringTag, { value: 'PluginArray' });

        const mArr = Object.create(MimeTypeArray.prototype);
        Object.defineProperty(mArr, 'length', { value: 0 });
        mArr.item = makeNative(function() { return null; }, 'item');
        mArr.namedItem = makeNative(function() { return null; }, 'namedItem');
        Object.defineProperty(mArr, Symbol.toStringTag, { value: 'MimeTypeArray' });
        return { pluginArr: pArr, mimeArr: mArr };
      }

      const pluginsData = [
        { name: 'PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'Chromium PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'Microsoft Edge PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'WebKit built-in PDF', filename: 'internal-pdf-viewer', description: 'Portable Document Format' }
      ];

      const mimesData = [
        { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' },
        { type: 'text/pdf', suffixes: 'pdf', description: 'Portable Document Format' }
      ];

      const pArr = Object.create(PluginArray.prototype);
      const mArr = Object.create(MimeTypeArray.prototype);

      const mimeObjs = mimesData.map(m => {
        const obj = Object.create(MimeType.prototype);
        Object.defineProperty(obj, 'type', { value: m.type, enumerable: true, configurable: true });
        Object.defineProperty(obj, 'suffixes', { value: m.suffixes, enumerable: true, configurable: true });
        Object.defineProperty(obj, 'description', { value: m.description, enumerable: true, configurable: true });
        Object.defineProperty(obj, Symbol.toStringTag, { value: 'MimeType' });
        return obj;
      });

      const pluginObjs = pluginsData.map(p => {
        const obj = Object.create(Plugin.prototype);
        Object.defineProperty(obj, 'name', { value: p.name, enumerable: true, configurable: true });
        Object.defineProperty(obj, 'filename', { value: p.filename, enumerable: true, configurable: true });
        Object.defineProperty(obj, 'description', { value: p.description, enumerable: true, configurable: true });
        Object.defineProperty(obj, 'length', { value: mimeObjs.length, enumerable: true, configurable: true });
        Object.defineProperty(obj, Symbol.toStringTag, { value: 'Plugin' });

        mimeObjs.forEach((m, mIdx) => {
          obj[mIdx] = m;
          obj[m.type] = m;
        });

        obj.item = makeNative(function(i) { return this[i] || null; }, 'item');
        obj.namedItem = makeNative(function(name) { return this[name] || null; }, 'namedItem');
        return obj;
      });

      // Point each mimeType's enabledPlugin to the primary PDF Viewer plugin
      mimeObjs.forEach(m => {
        Object.defineProperty(m, 'enabledPlugin', { value: pluginObjs[0], enumerable: true, configurable: true });
      });

      pluginObjs.forEach((p, idx) => {
        pArr[idx] = p;
        pArr[p.name] = p;
      });
      Object.defineProperty(pArr, 'length', { value: pluginObjs.length });
      pArr.item = makeNative(function(i) { return this[i] || null; }, 'item');
      pArr.namedItem = makeNative(function(name) { return this[name] || null; }, 'namedItem');
      pArr.refresh = makeNative(function() {}, 'refresh');
      Object.defineProperty(pArr, Symbol.toStringTag, { value: 'PluginArray' });

      mimeObjs.forEach((m, idx) => {
        mArr[idx] = m;
        mArr[m.type] = m;
      });
      Object.defineProperty(mArr, 'length', { value: mimeObjs.length });
      mArr.item = makeNative(function(i) { return this[i] || null; }, 'item');
      mArr.namedItem = makeNative(function(name) { return this[name] || null; }, 'namedItem');
      Object.defineProperty(mArr, Symbol.toStringTag, { value: 'MimeTypeArray' });

      return { pluginArr: pArr, mimeArr: mArr };
    }

    const { pluginArr, mimeArr } = buildPluginsAndMimes();

    if (window.Navigator && window.Navigator.prototype) {
      let getPlugins = function() { return pluginArr; };
      getPlugins = makeNative(getPlugins, 'get plugins');
      Object.defineProperty(window.Navigator.prototype, 'plugins', {
        get: getPlugins,
        configurable: true,
        enumerable: true
      });

      let getMimes = function() { return mimeArr; };
      getMimes = makeNative(getMimes, 'get mimeTypes');
      Object.defineProperty(window.Navigator.prototype, 'mimeTypes', {
        get: getMimes,
        configurable: true,
        enumerable: true
      });
    }
    if (navigator.hasOwnProperty('plugins')) {
      delete navigator.plugins;
    }
    if (navigator.hasOwnProperty('mimeTypes')) {
      delete navigator.mimeTypes;
    }

    // Permissions API alignment on Permissions.prototype
    if (window.Permissions && window.Permissions.prototype && window.Permissions.prototype.query) {
      try {
        const origPermQuery = window.Permissions.prototype.query;
        let patchedPermQuery = function(parameters) {
          if (parameters && parameters.name === 'notifications') {
            const notifPerm = (window.Notification && window.Notification.permission) || 'default';
            const notifState = (notifPerm === 'granted') ? 'granted' : ((notifPerm === 'denied') ? 'denied' : 'prompt');
            const mockStatus = {
              state: notifState,
              name: 'notifications',
              onchange: null,
              addEventListener: makeNative(function() {}, 'addEventListener'),
              removeEventListener: makeNative(function() {}, 'removeEventListener'),
              dispatchEvent: makeNative(function() { return true; }, 'dispatchEvent'),
              [Symbol.toStringTag]: 'PermissionStatus'
            };
            if (window.PermissionStatus && window.PermissionStatus.prototype) {
              Object.setPrototypeOf(mockStatus, window.PermissionStatus.prototype);
            }
            return Promise.resolve(mockStatus);
          }
          return origPermQuery.apply(this, arguments);
        };
        patchedPermQuery = makeNative(patchedPermQuery, 'query');
        window.Permissions.prototype.query = patchedPermQuery;
        if (navigator.permissions && navigator.permissions.hasOwnProperty('query')) {
          delete navigator.permissions.query;
        }
      } catch (e) {}
    }

    // Notification.permission & requestPermission alignment (non-enumerable matching native V8)
    if (typeof window !== 'undefined' && window.Notification) {
      try {
        let getNotifPerm = function() { return 'default'; };
        getNotifPerm = makeNative(getNotifPerm, 'get permission');
        Object.defineProperty(window.Notification, 'permission', {
          get: getNotifPerm,
          configurable: true,
          enumerable: false
        });

        if (window.Notification.requestPermission) {
          let patchedReqPerm = function(callback) {
            const res = Promise.resolve('default');
            if (typeof callback === 'function') {
              try { callback('default'); } catch(e) {}
            }
            return res;
          };
          patchedReqPerm = makeNative(patchedReqPerm, 'requestPermission');
          window.Notification.requestPermission = patchedReqPerm;
        }
      } catch (e) {}
    }
  } catch (e) {}

  // ==========================================
  // 12. WEBGL READPIXELS NOISE
  // ==========================================
  try {
    const rDelta = (rShift >= -1 && rShift <= 1) ? rShift : ((rShift % 3) - 1);
    const gDelta = (gShift >= -1 && gShift <= 1) ? gShift : ((gShift % 3) - 1);
    const bDelta = (bShift >= -1 && bShift <= 1) ? bShift : ((bShift % 3) - 1);

    function applyBufferNoise(pixels) {
      if (!pixels || !pixels.length) return;
      const step = Math.max(4, pixelStride * 4);
      for (let i = 0; i < pixels.length; i += step) {
        if (pixels[i + 3] > 0) {
          pixels[i]     = Math.max(0, Math.min(255, pixels[i]     + rDelta));
          pixels[i + 1] = Math.max(0, Math.min(255, pixels[i + 1] + gDelta));
          pixels[i + 2] = Math.max(0, Math.min(255, pixels[i + 2] + bDelta));
        }
      }
    }

    const origReadPixels = WebGLRenderingContext.prototype.readPixels;
    let patchedReadPixels = function() {
      const res = origReadPixels.apply(this, arguments);
      try {
        const pixels = arguments[6];
        if (pixels && pixels.length) applyBufferNoise(pixels);
      } catch (e) {}
      return res;
    };
    patchedReadPixels = makeNative(patchedReadPixels, 'readPixels');
    WebGLRenderingContext.prototype.readPixels = patchedReadPixels;

    if (window.WebGL2RenderingContext) {
      const origReadPixels2 = WebGL2RenderingContext.prototype.readPixels;
      let patchedReadPixels2 = function() {
        const res = origReadPixels2.apply(this, arguments);
        try {
          const pixels = arguments[6];
          if (pixels && pixels.length) applyBufferNoise(pixels);
        } catch (e) {}
        return res;
      };
      patchedReadPixels2 = makeNative(patchedReadPixels2, 'readPixels');
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
    const targetLoc = (cfg.locale && cfg.locale.trim()) || userLang;
    const targetTz = (cfg.timezone && cfg.timezone.trim()) || '';

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

    for (const ctor of intlConstructors) {
      if (ctor && ctor.prototype && ctor.prototype.resolvedOptions) {
        const origRes = ctor.prototype.resolvedOptions;
        let patchedRes = function() {
          const res = origRes.apply(this, arguments);
          if (res) {
            if (targetLoc) res.locale = targetLoc;
            if (ctor === Intl.DateTimeFormat && 'timeZone' in res) {
              if (targetTz) {
                res.timeZone = targetTz;
              } else if (tzLegacyMap[res.timeZone]) {
                res.timeZone = tzLegacyMap[res.timeZone];
              }
            }
          }
          return res;
        };
        patchedRes = makeNative(patchedRes, 'resolvedOptions');
        ctor.prototype.resolvedOptions = patchedRes;
      }
    }
  } catch (e) {}

  if (cfg.timezone && cfg.timezone.trim()) {
    try {
      const targetTz = cfg.timezone.trim();
      const origGetTimezoneOffset = Date.prototype.getTimezoneOffset;
      let patchedGetTimezoneOffset = function() {
        try {
          const utc = new Date(this.toLocaleString('en-US', { timeZone: 'UTC' }));
          const target = new Date(this.toLocaleString('en-US', { timeZone: targetTz }));
          const diff = Math.round((utc - target) / 60000);
          if (!isNaN(diff)) return diff;
        } catch(e) {}
        return origGetTimezoneOffset.apply(this, arguments);
      };
      patchedGetTimezoneOffset = makeNative(patchedGetTimezoneOffset, 'getTimezoneOffset');
      Date.prototype.getTimezoneOffset = patchedGetTimezoneOffset;
    } catch (e) {}
  }

  if (cfg.locale || cfg.acceptLanguage) {
    try {
      const userLang = cfg.locale || 'en-US';
      const userLangs = cfg.acceptLanguage ? cfg.acceptLanguage.split(',').map(l => l.split(';')[0].trim()) : [userLang, 'en'];
      
      let getLang = function() { return userLang; };
      getLang = makeNative(getLang, 'get language');
      Object.defineProperty(Navigator.prototype, 'language', { get: getLang, configurable: true, enumerable: true });

      let getLangs = function() { return Object.freeze(userLangs); };
      getLangs = makeNative(getLangs, 'get languages');
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
          let patchedCreateOffer = async function() {
            const offer = await origCreateOffer.apply(this, arguments);
            if (offer && offer.sdp) offer.sdp = filterSdp(offer.sdp);
            return offer;
          };
          patchedCreateOffer = makeNative(patchedCreateOffer, 'createOffer');
          pc.createOffer = patchedCreateOffer;

          const origCreateAnswer = pc.createAnswer;
          let patchedCreateAnswer = async function() {
            const answer = await origCreateAnswer.apply(this, arguments);
            if (answer && answer.sdp) answer.sdp = filterSdp(answer.sdp);
            return answer;
          };
          patchedCreateAnswer = makeNative(patchedCreateAnswer, 'createAnswer');
          pc.createAnswer = patchedCreateAnswer;

          const origAddEventListener = pc.addEventListener;
          pc.addEventListener = function(type, listener, options) {
            if (type === 'icecandidate' && typeof listener === 'function') {
              const wrappedListener = function(event) {
                if (event && event.candidate && event.candidate.candidate) {
                  if (localIpRegex.test(event.candidate.candidate) || (event.candidate.address && localIpRegex.test(event.candidate.address))) {
                    return;
                  }
                }
                return listener.apply(this, arguments);
              };
              return origAddEventListener.call(this, type, wrappedListener, options);
            }
            return origAddEventListener.apply(this, arguments);
          };
          pc.addEventListener = makeNative(pc.addEventListener, 'addEventListener');

          return pc;
        };
        WebRTCProxy.prototype = origRTC.prototype;
        WebRTCProxy = makeNative(WebRTCProxy, 'RTCPeerConnection');
        window.RTCPeerConnection = WebRTCProxy;
        window.webkitRTCPeerConnection = WebRTCProxy;
      }
    }
  } catch (e) {}

  // ==========================================
  // 15. SELECTIVE CROSS-OS FONT SHIELD & PER-PROFILE METRICS SPOOFING
  // ==========================================
  try {
    const isAppleOS = (targetOSName === 'macOS' || targetOSName === 'iOS');
    const isLinuxOS = (targetOSName === 'Linux');

    // Windows font families to mask on non-Windows profiles (macOS, iOS, Linux)
    const winBlockedPrefixes = [
      'segoe', 'calibri', 'cambria', 'consolas', 'tahoma',
      'ms gothic', 'ms pgothic', 'ms ui gothic', 'ms sans serif', 'ms serif',
      'arial black', 'century gothic', 'franklin gothic', 'lucida console',
      'palatino linotype', 'sitka', 'corbel', 'candara', 'constantia', 'ebrima',
      'gadugi', 'leelawadee', 'malgun gothic', 'microsoft',
      'simsun', 'nsimsun', 'yu gothic', 'comic sans', 'bahnschrift', 'agency fb', 'algerian', 'marlett'
    ];

    // Authentic Apple system fonts to affirm on macOS / iOS
    const appleSystemFonts = new Set([
      '-apple-system', 'blinkmacsystemfont', 'helvetica neue', 'helvetica',
      'san francisco', 'sf pro', 'sf pro text', 'sf pro display', 'sf mono',
      'monaco', 'menlo', 'geneva', 'lucida grande', 'apple color emoji',
      'american typewriter', 'andale mono', 'arial', 'courier', 'courier new',
      'georgia', 'times new roman', 'trebuchet ms', 'verdana', 'impact', 'charter'
    ]);

    function cleanFontName(fontStr) {
      if (!fontStr) return '';
      return fontStr.toLowerCase().replace(/['"]/g, '').trim();
    }

    // Precise detector for font enumeration and metrics probing elements
    function isFontProbeElement(elem) {
      if (!elem) return false;
      try {
        if (elem.id && (elem.id.includes('font') || elem.id.includes('glyph'))) return true;
        if (elem.closest && (
          elem.closest('#fonts-metrics-testbox') ||
          elem.closest('#fonts-glyphs-testbox') ||
          elem.closest('[id*="font"]') ||
          elem.closest('[id*="glyph"]')
        )) return true;
        const s = elem.style;
        if (!s) return false;
        if (s.fontSize === '128px' || s.fontSize === '72px' || s.fontSize === '48px') return true;
        if (s.position === 'absolute' || s.position === 'fixed') {
          const l = parseFloat(s.left);
          const t = parseFloat(s.top);
          if ((!isNaN(l) && l < -200) || (!isNaN(t) && t < -200)) return true;
        }
      } catch (e) {}
      return false;
    }

    // Deterministic micro-variation noise seeded per profile
    function getFontNoise(elem, prop) {
      const text = (elem.textContent || elem.innerText || '');
      const ff = cleanFontName(elem.style ? elem.style.fontFamily : '');
      const str = text.slice(0, 30) + ':' + ff + ':' + prop;
      let h = seedHash('font_metrics');
      for (let i = 0; i < str.length; i++) {
        h = (h * 31 + str.charCodeAt(i)) & 0x7FFFFFFF;
      }
      return (h % 5) - 2; // Stable -2 to +2 px offset
    }

    // 1. FontFaceSet.check() & document.fonts.check() Hook
    const fontTarget = (window.FontFaceSet && window.FontFaceSet.prototype) ? window.FontFaceSet.prototype : (document.fonts || {});
    if (fontTarget && fontTarget.check) {
      const origCheck = fontTarget.check;
      let hookedCheck = function(fontStr, text) {
        if (fontStr) {
          const fontClean = cleanFontName(fontStr);
          if (isAppleOS || isLinuxOS) {
            if (winBlockedPrefixes.some(b => fontClean.includes(b))) return false;
          }
          if (isAppleOS) {
            if (appleSystemFonts.has(fontClean.split(',')[0].trim())) return true;
          }
        }
        try {
          return origCheck.apply(this, arguments);
        } catch (e) {
          return false;
        }
      };
      hookedCheck = makeNative(hookedCheck, 'check');
      fontTarget.check = hookedCheck;
      if (document.fonts) document.fonts.check = hookedCheck;
    }

    // 2. DOM Measuring Hooks (offsetWidth, offsetHeight)
    if (window.HTMLElement && window.HTMLElement.prototype) {
      const descW = Object.getOwnPropertyDescriptor(window.HTMLElement.prototype, 'offsetWidth');
      const descH = Object.getOwnPropertyDescriptor(window.HTMLElement.prototype, 'offsetHeight');

      if (descW && descW.get && descH && descH.get) {
        const origOffsetW = descW.get;
        const origOffsetH = descH.get;

        let fallbackW = null;
        let fallbackH = null;

        let patchedOffsetW = function() {
          const val = origOffsetW.call(this);
          if (val === 0) return val;

          if (isFontProbeElement(this)) {
            const ff = cleanFontName(this.style ? this.style.fontFamily : '');
            if (ff.includes('br0k3nd3f4u17')) {
              fallbackW = val;
              return val;
            }
            if ((isAppleOS || isLinuxOS) && winBlockedPrefixes.some(b => ff.includes(b))) {
              return fallbackW !== null ? fallbackW : val;
            }
            if (isAppleOS && appleSystemFonts.has(ff.split(',')[0].trim())) {
              if (val === fallbackW) return val + 28 + getFontNoise(this, 'w');
            }
            const n = getFontNoise(this, 'w');
            return Math.max(1, val + n);
          }
          return val;
        };
        patchedOffsetW = makeNative(patchedOffsetW, 'get offsetWidth');
        Object.defineProperty(window.HTMLElement.prototype, 'offsetWidth', {
          get: patchedOffsetW,
          enumerable: true,
          configurable: true
        });

        let patchedOffsetH = function() {
          const val = origOffsetH.call(this);
          if (val === 0) return val;

          if (isFontProbeElement(this)) {
            const ff = cleanFontName(this.style ? this.style.fontFamily : '');
            if (ff.includes('br0k3nd3f4u17')) {
              fallbackH = val;
              return val;
            }
            if ((isAppleOS || isLinuxOS) && winBlockedPrefixes.some(b => ff.includes(b))) {
              return fallbackH !== null ? fallbackH : val;
            }
            if (isAppleOS && appleSystemFonts.has(ff.split(',')[0].trim())) {
              if (val === fallbackH) return val + 28 + getFontNoise(this, 'h');
            }
            const n = getFontNoise(this, 'h');
            return Math.max(1, val + n);
          }
          return val;
        };
        patchedOffsetH = makeNative(patchedOffsetH, 'get offsetHeight');
        Object.defineProperty(window.HTMLElement.prototype, 'offsetHeight', {
          get: patchedOffsetH,
          enumerable: true,
          configurable: true
        });
      }
    }

    // 3. getBoundingClientRect Hook for rect-based font probes
    if (window.Element && window.Element.prototype) {
      const origGetBCR = window.Element.prototype.getBoundingClientRect;
      let patchedGetBCR = function() {
        const r = origGetBCR.call(this);
        if (isFontProbeElement(this)) {
          const nw = getFontNoise(this, 'w');
          const nh = getFontNoise(this, 'h');
          return new DOMRect(r.x, r.y, Math.max(1, r.width + nw), Math.max(1, r.height + nh));
        }
        return r;
      };
      patchedGetBCR = makeNative(patchedGetBCR, 'getBoundingClientRect');
      window.Element.prototype.getBoundingClientRect = patchedGetBCR;
    }
  } catch (e) {}

  // ==========================================
  // 16. ADVANCED AUDIO FINGERPRINTING SPOOFING
  // ==========================================
  try {
    if (window.OfflineAudioContext || window.webkitOfflineAudioContext) {
      const AudioCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      const origStartRendering = AudioCtx.prototype.startRendering;
      let patchedStartRendering = async function() {
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
      patchedStartRendering = makeNative(patchedStartRendering, 'startRendering');
      AudioCtx.prototype.startRendering = patchedStartRendering;
    }
    if (window.AnalyserNode) {
      const origGetFloatFreq = AnalyserNode.prototype.getFloatFrequencyData;
      let patchedGetFloatFreq = function(array) {
        origGetFloatFreq.apply(this, arguments);
        if (array && array.length) {
          for (let i = 0; i < array.length; i += 50) {
            array[i] = array[i] + (audioNoise * 1000);
          }
        }
      };
      patchedGetFloatFreq = makeNative(patchedGetFloatFreq, 'getFloatFrequencyData');
      AnalyserNode.prototype.getFloatFrequencyData = patchedGetFloatFreq;

      const origGetByteFreq = AnalyserNode.prototype.getByteFrequencyData;
      let patchedGetByteFreq = function(array) {
        origGetByteFreq.apply(this, arguments);
        if (array && array.length) {
          const delta = (seedHash('bytefreq') % 3) - 1;
          for (let i = 0; i < array.length; i += 50) {
            if (array[i] > 0 && array[i] < 255) {
              array[i] = Math.max(0, Math.min(255, array[i] + delta));
            }
          }
        }
      };
      patchedGetByteFreq = makeNative(patchedGetByteFreq, 'getByteFrequencyData');
      AnalyserNode.prototype.getByteFrequencyData = patchedGetByteFreq;

      const origGetByteTime = AnalyserNode.prototype.getByteTimeDomainData;
      let patchedGetByteTime = function(array) {
        origGetByteTime.apply(this, arguments);
        if (array && array.length) {
          const delta = (seedHash('bytetimed') % 3) - 1;
          for (let i = 0; i < array.length; i += 50) {
            if (array[i] > 0 && array[i] < 255) {
              array[i] = Math.max(0, Math.min(255, array[i] + delta));
            }
          }
        }
      };
      patchedGetByteTime = makeNative(patchedGetByteTime, 'getByteTimeDomainData');
      AnalyserNode.prototype.getByteTimeDomainData = patchedGetByteTime;
    }
  } catch (e) {}

  // ==========================================
  // 17. WEB WORKER GLOBAL SCOPE PREAMBLE
  // ==========================================
  try {
    if (window.URL && window.URL.createObjectURL) {
      const origCreateObjectURL = window.URL.createObjectURL;
      let patchedCreateObjectURL = function(obj) {
        try {
          if (obj instanceof Blob && obj.type && (obj.type === 'application/javascript' || obj.type === 'text/javascript')) {
            const shim = `try {
  const _wNav = self.navigator;
  if (_wNav) {
    const _p = {
      hardwareConcurrency: ${cpuCores},
      deviceMemory: ${memoryGb},
      platform: ${JSON.stringify(targetPlatform)},
      userAgent: ${JSON.stringify(ua)},
      languages: Object.freeze(${JSON.stringify(userLangs)})
    };
    for (const [k, v] of Object.entries(_p)) {
      try {
        Object.defineProperty(Object.getPrototypeOf(_wNav), k, { get: () => v, configurable: true, enumerable: true });
      } catch(e) {}
    }
  }
} catch(e) {}
`;
            const modifiedBlob = new Blob([shim, '\n', obj], { type: obj.type });
            return origCreateObjectURL.call(this, modifiedBlob);
          }
        } catch(e) {}
        return origCreateObjectURL.apply(this, arguments);
      };
      patchedCreateObjectURL = makeNative(patchedCreateObjectURL, 'createObjectURL');
      window.URL.createObjectURL = patchedCreateObjectURL;
    }
  } catch(e) {}
  // ==========================================
  // 18. WEBGPU ADAPTER & ARCHITECTURE SPOOFING
  // ==========================================
  try {
    if (navigator.gpu && navigator.gpu.requestAdapter) {
      const origRequestAdapter = navigator.gpu.requestAdapter;
      let patchedRequestAdapter = async function(options) {
        const adapter = await origRequestAdapter.apply(this, arguments);
        if (!adapter) return adapter;

        const fakeInfo = {
          vendor: webglVendor.toLowerCase().includes('nvidia') ? 'nvidia' : (webglVendor.toLowerCase().includes('apple') ? 'apple' : (webglVendor.toLowerCase().includes('intel') ? 'intel' : 'google')),
          architecture: targetArch === 'arm' ? 'arm64' : 'x86_64',
          device: webglRenderer,
          description: webglRenderer,
          [Symbol.toStringTag]: 'GPUAdapterInfo'
        };

        if (window.GPUAdapterInfo && window.GPUAdapterInfo.prototype) {
          Object.setPrototypeOf(fakeInfo, window.GPUAdapterInfo.prototype);
        }

        if (window.GPUAdapter && window.GPUAdapter.prototype) {
          if (window.GPUAdapter.prototype.requestAdapterInfo) {
            let patchedReqInfo = async function() { return fakeInfo; };
            patchedReqInfo = makeNative(patchedReqInfo, 'requestAdapterInfo');
            window.GPUAdapter.prototype.requestAdapterInfo = patchedReqInfo;
          }
          if ('info' in window.GPUAdapter.prototype) {
            try {
              let getInfo = function() { return fakeInfo; };
              getInfo = makeNative(getInfo, 'get info');
              Object.defineProperty(window.GPUAdapter.prototype, 'info', {
                get: getInfo,
                configurable: true,
                enumerable: true
              });
            } catch(e) {}
          }
        }
        return adapter;
      };
      patchedRequestAdapter = makeNative(patchedRequestAdapter, 'requestAdapter');
      navigator.gpu.requestAdapter = patchedRequestAdapter;
    }
  } catch(e) {}

  // ==========================================
  // 19. WINDOW.CHROME OBJECT INTEGRITY DISGUISE
  // ==========================================
  try {
    if (typeof window !== 'undefined') {
      if (!window.chrome) {
        window.chrome = {};
      }
      if (!window.chrome.app) {
        window.chrome.app = {
          isInstalled: false,
          InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
          RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' },
          getIsInstalled: makeNative(function() { return false; }, 'getIsInstalled'),
          getDetails: makeNative(function() { return null; }, 'getDetails'),
          installState: makeNative(function() {}, 'installState')
        };
      }
      if (!window.chrome.csi) {
        let csiFn = function() {
          return {
            startE: Math.floor(performance.timeOrigin || (performance.timing ? performance.timing.navigationStart : Date.now())),
            onloadT: Math.floor((performance.timing ? performance.timing.loadEventEnd : Date.now())),
            pageT: (performance.now ? performance.now() : 0),
            tran: 15
          };
        };
        csiFn = makeNative(csiFn, 'csi');
        window.chrome.csi = csiFn;
      }
      if (!window.chrome.loadTimes) {
        let loadTimesFn = function() {
          const t = performance.timing || {};
          const origin = performance.timeOrigin || t.navigationStart || Date.now();
          return {
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
          };
        };
        loadTimesFn = makeNative(loadTimesFn, 'loadTimes');
        window.chrome.loadTimes = loadTimesFn;
      }
    }
  } catch(e) {}

  // ==========================================
  // 20. ERROR CALL-STACK LEAK SANITIZATION
  // ==========================================
  try {
    const descStack = Object.getOwnPropertyDescriptor(Error.prototype, 'stack');
    if (descStack && descStack.get) {
      const origStackGet = descStack.get;
      let patchedStackGet = function() {
        const s = origStackGet.call(this);
        if (typeof s === 'string') {
          return s.split('\n').filter(l => !l.includes('inject.js') && !l.includes('config.js')).join('\n');
        }
        return s;
      };
      patchedStackGet = makeNative(patchedStackGet, 'get stack');
      Object.defineProperty(Error.prototype, 'stack', {
        get: patchedStackGet,
        set: descStack.set,
        configurable: true
      });
    }
  } catch(e) {}

  // ==========================================
  // 21. PERFORMANCE TIMELINE SANITIZER (EXTENSION SHIELD)
  // ==========================================
  try {
    if (typeof Performance !== 'undefined' && Performance.prototype) {
      function sanitizePerfEntries(entries) {
        if (!entries || !entries.length) return entries;
        return entries.filter(e => {
          const n = (e && e.name) ? String(e.name) : '';
          return !n.includes('inject.js') && !n.includes('config.js');
        });
      }

      if (Performance.prototype.getEntries) {
        const origGetEntries = Performance.prototype.getEntries;
        let patchedGetEntries = function() {
          return sanitizePerfEntries(origGetEntries.apply(this, arguments));
        };
        patchedGetEntries = makeNative(patchedGetEntries, 'getEntries');
        Performance.prototype.getEntries = patchedGetEntries;
      }

      if (Performance.prototype.getEntriesByType) {
        const origGetEntriesByType = Performance.prototype.getEntriesByType;
        let patchedGetEntriesByType = function(type) {
          return sanitizePerfEntries(origGetEntriesByType.apply(this, arguments));
        };
        patchedGetEntriesByType = makeNative(patchedGetEntriesByType, 'getEntriesByType');
        Performance.prototype.getEntriesByType = patchedGetEntriesByType;
      }

      if (Performance.prototype.getEntriesByName) {
        const origGetEntriesByName = Performance.prototype.getEntriesByName;
        let patchedGetEntriesByName = function(name, type) {
          if (typeof name === 'string' && (name.includes('inject.js') || name.includes('config.js'))) {
            return [];
          }
          return sanitizePerfEntries(origGetEntriesByName.apply(this, arguments));
        };
        patchedGetEntriesByName = makeNative(patchedGetEntriesByName, 'getEntriesByName');
        Performance.prototype.getEntriesByName = patchedGetEntriesByName;
      }
    }
  } catch(e) {}

  // ==========================================
  // 22. NETWORK INFORMATION API (NAVIGATOR.CONNECTION)
  // ==========================================
  try {
    if (targetOSName !== 'iOS') {
      const netInfo = {
        downlink: 10,
        effectiveType: '4g',
        rtt: 50,
        saveData: false,
        onchange: null,
        addEventListener: makeNative(function() {}, 'addEventListener'),
        removeEventListener: makeNative(function() {}, 'removeEventListener'),
        dispatchEvent: makeNative(function() { return true; }, 'dispatchEvent'),
        [Symbol.toStringTag]: 'NetworkInformation'
      };

      if (window.NetworkInformation && window.NetworkInformation.prototype) {
        Object.setPrototypeOf(netInfo, window.NetworkInformation.prototype);
        const defNetGetter = (p, v) => {
          let g = function() { return v; };
          g = makeNative(g, `get ${p}`);
          try {
            Object.defineProperty(window.NetworkInformation.prototype, p, {
              get: g,
              configurable: true,
              enumerable: true
            });
          } catch(e) {}
        };
        defNetGetter('downlink', 10);
        defNetGetter('effectiveType', '4g');
        defNetGetter('rtt', 50);
        defNetGetter('saveData', false);
      }

      if (window.Navigator && window.Navigator.prototype) {
        let getConn = function() { return netInfo; };
        getConn = makeNative(getConn, 'get connection');
        Object.defineProperty(window.Navigator.prototype, 'connection', {
          get: getConn,
          configurable: true,
          enumerable: true
        });
      }
      if (navigator.hasOwnProperty('connection')) {
        delete navigator.connection;
      }
    }
  } catch(e) {}

  // ==========================================
  // 23. KEYBOARD LAYOUT MAP ALIGNMENT
  // ==========================================
  try {
    if (userLang.startsWith('en') && navigator.keyboard && navigator.keyboard.getLayoutMap) {
      const qwertyMap = new Map([
        ['KeyA', 'a'], ['KeyB', 'b'], ['KeyC', 'c'], ['KeyD', 'd'], ['KeyE', 'e'],
        ['KeyF', 'f'], ['KeyG', 'g'], ['KeyH', 'h'], ['KeyI', 'i'], ['KeyJ', 'j'],
        ['KeyK', 'k'], ['KeyL', 'l'], ['KeyM', 'm'], ['KeyN', 'n'], ['KeyO', 'o'],
        ['KeyP', 'p'], ['KeyQ', 'q'], ['KeyR', 'r'], ['KeyS', 's'], ['KeyT', 't'],
        ['KeyU', 'u'], ['KeyV', 'v'], ['KeyW', 'w'], ['KeyX', 'x'], ['KeyY', 'y'],
        ['KeyZ', 'z'], ['Digit1', '1'], ['Digit2', '2'], ['Digit3', '3'],
        ['Digit4', '4'], ['Digit5', '5'], ['Digit6', '6'], ['Digit7', '7'],
        ['Digit8', '8'], ['Digit9', '9'], ['Digit0', '0'], ['Minus', '-'],
        ['Equal', '='], ['BracketLeft', '['], ['BracketRight', ']'],
        ['Backquote', '`'], ['Semicolon', ';'], ['Quote', "'"], ['Comma', ','],
        ['Period', '.'], ['Slash', '/'], ['Backslash', '\\']
      ]);
      let patchedGetLayoutMap = async function() {
        return qwertyMap;
      };
      patchedGetLayoutMap = makeNative(patchedGetLayoutMap, 'getLayoutMap');
      if (window.Keyboard && window.Keyboard.prototype) {
        window.Keyboard.prototype.getLayoutMap = patchedGetLayoutMap;
      } else {
        navigator.keyboard.getLayoutMap = patchedGetLayoutMap;
      }
    }
  } catch(e) {}

})();
