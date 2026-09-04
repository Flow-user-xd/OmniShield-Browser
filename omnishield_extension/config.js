// OmniShield Profile Config - Base Template
(function() {
  const cfg = {
    canvasR: 3,
    canvasG: 2,
    canvasB: 5,
    canvasStride: 8,
    webglVendor: 'Google Inc. (NVIDIA)',
    webglRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0)',
    cpuCores: 8,
    memoryGb: 16,
    audioNoise: 0.0000001
  };
  if (typeof self !== 'undefined' && typeof window === 'undefined') {
    self.__OMNI_CONFIG = cfg;
  }
  if (typeof window !== 'undefined') {
    try {
      Object.defineProperty(window, '__omni_tmp_cfg__', {
        value: cfg,
        configurable: true,
        enumerable: false,
        writable: true
      });
    } catch (e) {
      window.__OMNI_CONFIG = cfg;
    }
  }
})();
