// OmniShield Profile Config - Base Template
const OMNI_CFG = {
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
if (typeof self !== 'undefined') self.__OMNI_CONFIG = OMNI_CFG;
if (typeof window !== 'undefined') window.__OMNI_CONFIG = OMNI_CFG;
