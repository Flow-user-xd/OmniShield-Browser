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
    targetPlatform = 'Linux aarch64';
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
    delete Object.getPrototypeOf(navigator).webdriver;
    Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true, enumerable: true });
    if (window.Navigator && window.Navigator.prototype) {
      Object.defineProperty(window.Navigator.prototype, 'webdriver', { get: () => false, configurable: true, enumerable: true });
    }
  } catch (e) {}

  // ==========================================
  // 2. NAVIGATOR & PLATFORM SPOOFING
  // ==========================================
  try {
    const navProps = {
      platform: targetPlatform,
      hardwareConcurrency: cpuCores,
      deviceMemory: memoryGb,
      languages: ['en-US', 'en'],
      userAgent: ua,
      appVersion: ua.replace(/^Mozilla\//, ''),
      maxTouchPoints: (targetOSName === 'Android' || targetOSName === 'iOS') ? 5 : 0,
      pdfViewerEnabled: (targetOSName === 'Android' || targetOSName === 'iOS') ? false : true
    };

    if (window.Navigator && window.Navigator.prototype) {
      for (const [p, v] of Object.entries(navProps)) {
        try {
          Object.defineProperty(window.Navigator.prototype, p, { get: () => v, configurable: true, enumerable: true });
        } catch (e) {}
      }
    }
    for (const [p, v] of Object.entries(navProps)) {
      try {
        Object.defineProperty(navigator, p, { get: () => v, configurable: true, enumerable: true });
      } catch (e) {}
    }
  } catch (e) {}

  // Client Hints (Sec-CH-UA)
  if (navigator.userAgentData) {
    try {
      const customUAData = {
        brands: [
          { brand: 'Not/A)Brand', version: '8' },
          { brand: 'Chromium', version: '150' },
          { brand: 'Google Chrome', version: '150' }
        ],
        mobile: isMobile,
        platform: targetOSName,
        getHighEntropyValues: async (hints = []) => ({
          architecture: targetArch,
          bitness: '64',
          brands: [
            { brand: 'Not/A)Brand', version: '8.0.0.0' },
            { brand: 'Chromium', version: '150.0.7871.187' },
            { brand: 'Google Chrome', version: '150.0.7871.187' }
          ],
          mobile: isMobile,
          model: targetModel,
          platform: targetOSName,
          platformVersion: targetPlatformVersion,
          uaFullVersion: '150.0.7871.187'
        })
      };

      if (window.NavigatorUAData && window.NavigatorUAData.prototype) {
        try {
          Object.defineProperty(window.NavigatorUAData.prototype, 'platform', { get: () => targetOSName, configurable: true });
          Object.defineProperty(window.NavigatorUAData.prototype, 'mobile', { get: () => isMobile, configurable: true });
          window.NavigatorUAData.prototype.getHighEntropyValues = customUAData.getHighEntropyValues;
        } catch (e) {}
      }

      Object.defineProperty(navigator, 'userAgentData', { get: () => customUAData, configurable: true });
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
    WebGLRenderingContext.prototype.getParameter = function(param) {
      if (param === 37445) return webglVendor;       // UNMASKED_VENDOR_WEBGL
      if (param === 37446) return webglRenderer;      // UNMASKED_RENDERER_WEBGL
      if (param === 3379)  return maxTexSize;         // MAX_TEXTURE_SIZE
      if (param === 34024) return maxRenderSize;      // MAX_RENDERBUFFER_SIZE
      if (param === 3386)  return maxViewportDims;    // MAX_VIEWPORT_DIMS
      return getParamOrig.apply(this, arguments);
    };

    if (window.WebGL2RenderingContext) {
      const getParamOrig2 = WebGL2RenderingContext.prototype.getParameter;
      WebGL2RenderingContext.prototype.getParameter = function(param) {
        if (param === 37445) return webglVendor;
        if (param === 37446) return webglRenderer;
        if (param === 3379)  return maxTexSize;
        if (param === 34024) return maxRenderSize;
        if (param === 3386)  return maxViewportDims;
        return getParamOrig2.apply(this, arguments);
      };
    }
  } catch (e) {}

  // ==========================================
  // 5. CANVAS 2D NOISE INJECTION
  // ==========================================
  function applyPixelNoise(data) {
    if (!data || !data.length) return;
    const step = pixelStride * 4;
    for (let i = 0; i < data.length; i += step) {
      if (data[i + 3] > 0) {
        data[i]     = (data[i]     + rShift) & 255;
        data[i + 1] = (data[i + 1] + gShift) & 255;
        data[i + 2] = (data[i + 2] + bShift) & 255;
      }
    }
  }

  try {
    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
    const origToBlob = HTMLCanvasElement.prototype.toBlob;

    HTMLCanvasElement.prototype.toDataURL = function() {
      try {
        const ctx = this.getContext('2d');
        if (ctx) {
          const imgData = origGetImageData.call(ctx, 0, 0, this.width, this.height);
          if (imgData && imgData.data) {
            applyPixelNoise(imgData.data);
            ctx.putImageData(imgData, 0, 0);
          }
        }
      } catch (err) {}
      return origToDataURL.apply(this, arguments);
    };

    CanvasRenderingContext2D.prototype.getImageData = function(x, y, w, h) {
      const res = origGetImageData.apply(this, arguments);
      try {
        if (res && res.data) {
          applyPixelNoise(res.data);
        }
      } catch (e) {}
      return res;
    };

    HTMLCanvasElement.prototype.toBlob = function(callback, type, quality) {
      try {
        const ctx = this.getContext('2d');
        if (ctx) {
          const imgData = origGetImageData.call(ctx, 0, 0, this.width, this.height);
          if (imgData && imgData.data) {
            applyPixelNoise(imgData.data);
            ctx.putImageData(imgData, 0, 0);
          }
        }
      } catch (err) {}
      return origToBlob.call(this, callback, type, quality);
    };
  } catch (e) {}

  // ==========================================
  // 6. FONT MEASUREMENT MICRO-NOISE
  // ==========================================
  try {
    const fontOffset = ((seedHash('font') % 100) - 50) * 0.0001; // Tiny offset e.g. -0.0050 to +0.0050
    const origMeasureText = CanvasRenderingContext2D.prototype.measureText;
    CanvasRenderingContext2D.prototype.measureText = function(text) {
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
  } catch (e) {}

  // ==========================================
  // 7. AUDIOCONTEXT FINGERPRINT NOISE
  // ==========================================
  try {
    const origGetChannelData = AudioBuffer.prototype.getChannelData;
    AudioBuffer.prototype.getChannelData = function() {
      const results = origGetChannelData.apply(this, arguments);
      if (results && results.length) {
        for (let i = 0; i < results.length; i += 100) {
          results[i] = results[i] + audioNoise;
        }
      }
      return results;
    };
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
  if (navigator.getBattery) {
    try {
      const batLevel = ((seedHash('bat') % 60) + 35) / 100.0; // 35% - 95%
      const isCharging = (seedHash('batcharge') % 2 === 0);

      const mockBattery = {
        charging: isCharging,
        chargingTime: isCharging ? 1200 : Infinity,
        dischargingTime: isCharging ? Infinity : 14400,
        level: batLevel,
        addEventListener: () => {},
        removeEventListener: () => {}
      };

      navigator.getBattery = async function() {
        return mockBattery;
      };
    } catch (e) {}
  }

  // ==========================================
  // 11. NAVIGATOR PLUGINS & MIMETYPES SPOOFING
  // ==========================================
  try {
    const isMobileOS = (targetOSName === 'Android' || targetOSName === 'iOS');
    const mockPlugins = isMobileOS ? [] : [
      { name: 'PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
      { name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' }
    ];
    if (window.Navigator && window.Navigator.prototype) {
      try { Object.defineProperty(window.Navigator.prototype, 'plugins', { get: () => mockPlugins, configurable: true, enumerable: true }); } catch (e) {}
    }
    Object.defineProperty(navigator, 'plugins', { get: () => mockPlugins, configurable: true, enumerable: true });
  } catch (e) {}

  // ==========================================
  // 12. WEBGL READPIXELS NOISE
  // ==========================================
  try {
    const origReadPixels = WebGLRenderingContext.prototype.readPixels;
    WebGLRenderingContext.prototype.readPixels = function() {
      origReadPixels.apply(this, arguments);
      const buf = arguments[6];
      if (buf && buf.length) {
        applyPixelNoise(buf);
      }
    };

    if (window.WebGL2RenderingContext) {
      const origReadPixels2 = WebGL2RenderingContext.prototype.readPixels;
      WebGL2RenderingContext.prototype.readPixels = function() {
        origReadPixels2.apply(this, arguments);
        const buf = arguments[6];
        if (buf && buf.length) {
          applyPixelNoise(buf);
        }
      };
    }
  // ==========================================
  // 13. TIMEZONE & LOCALE SPOOFING
  // ==========================================
  if (cfg.timezone) {
    try {
      const targetTZ = cfg.timezone;
      const origResolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions;
      Intl.DateTimeFormat.prototype.resolvedOptions = function() {
        const res = origResolvedOptions.apply(this, arguments);
        res.timeZone = targetTZ;
        return res;
      };
    } catch (e) {}
  }

  if (cfg.locale || cfg.acceptLanguage) {
    try {
      const userLang = cfg.locale || 'en-US';
      const userLangs = cfg.acceptLanguage ? cfg.acceptLanguage.split(',').map(l => l.split(';')[0].trim()) : [userLang, 'en'];
      Object.defineProperty(navigator, 'language', { get: () => userLang, configurable: true });
      Object.defineProperty(navigator, 'languages', { get: () => userLangs, configurable: true });
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
    const allowedFonts = (targetOSName === 'macOS' || targetOSName === 'iOS') ? macFonts : winFonts;

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
