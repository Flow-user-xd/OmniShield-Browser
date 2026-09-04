document.addEventListener('DOMContentLoaded', () => {
  const cfg = (typeof window.__OMNI_CONFIG !== 'undefined' ? window.__OMNI_CONFIG : (typeof OMNI_CFG !== 'undefined' ? OMNI_CFG : {}));
  if (cfg.canvasR) {
    const cEl = document.getElementById('canvasVal');
    if (cEl) cEl.textContent = 'R:' + cfg.canvasR + ' G:' + cfg.canvasG + ' B:' + cfg.canvasB;
  }
  if (cfg.webglRenderer) {
    const wEl = document.getElementById('webglVal');
    if (wEl) wEl.textContent = (cfg.webglRenderer.includes('NVIDIA') ? 'NVIDIA RTX' : (cfg.webglRenderer.includes('Apple') ? 'Apple Silicon' : 'Spoofed GPU'));
  }
  const hwEl = document.getElementById('hwVal');
  if (hwEl) {
    const cores = cfg.cpuCores || navigator.hardwareConcurrency || 8;
    const mem = cfg.memoryGb || 16;
    hwEl.textContent = cores + ' Cores · ' + mem + ' GB';
  }
  const geoEl = document.getElementById('geoVal');
  if (geoEl) {
    const tz = cfg.timezone || 'Direct';
    const loc = cfg.locale || 'en-US';
    const shortTz = tz.includes('/') ? tz.split('/')[1].replace(/_/g, ' ') : tz;
    geoEl.textContent = shortTz + ' (' + loc + ')';
  }
  const rtcEl = document.getElementById('webrtcVal');
  if (rtcEl) {
    rtcEl.textContent = cfg.webrtc || 'Proxy IP Masked';
  }
  const btn = document.getElementById('btnTest');
  if (btn) {
    btn.addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://browserleaks.com/canvas' });
    });
  }
});
