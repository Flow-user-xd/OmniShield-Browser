export const INITIAL_PROFILES = [
  {
    id: 'prof-1',
    name: 'Workstation Alpha - US East',
    group: 'Social Ads',
    tags: ['Facebook', 'Ads Manager', 'High Anonymity'],
    status: 'stopped', // 'running' | 'stopped'
    lastLaunched: '2026-07-24 18:30',
    
    // Fingerprint parameters
    os: 'Windows 11',
    browser: 'Chrome 150',
    useragent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.7871.187 Safari/537.36',
    
    resolution: {
      preset: '1920x1080',
      width: 1920,
      height: 1080,
      devicePixelRatio: 1
    },
    
    hardware: {
      cpuCores: 8,
      memoryGb: 16,
      webGlVendor: 'Google Inc. (NVIDIA)',
      webGlRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0)',
      canvasNoise: 'Noise (Hash offset)',
      audioNoise: 'Enabled (+0.00001db)',
      fonts: ['Arial', 'Calibri', 'Segoe UI', 'Times New Roman', 'Verdana']
    },

    proxy: {
      enabled: true,
      type: 'SOCKS5',
      ip: '198.51.100.42',
      port: '1080',
      username: 'user_us_east',
      password: '••••••••',
      location: 'New York, US',
      timezone: 'America/New_York',
      lat: 40.7128,
      lng: -74.0060,
      webrtc: 'Proxy IP'
    },

    storage: {
      cookiesCount: 42,
      localStorageKeys: 18,
      hasSession: true
    }
  },
  {
    id: 'prof-2',
    name: 'MacBook Pro - EU Central',
    group: 'E-Commerce',
    tags: ['Amazon Seller', 'EU Proxy', 'macOS'],
    status: 'stopped',
    lastLaunched: '2026-07-25 10:15',
    
    os: 'macOS Sonoma',
    browser: 'Chrome 150',
    useragent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    
    resolution: {
      preset: '2560x1440',
      width: 2560,
      height: 1440,
      devicePixelRatio: 2
    },
    
    hardware: {
      cpuCores: 12,
      memoryGb: 32,
      webGlVendor: 'Apple Inc.',
      webGlRenderer: 'Apple M3 Max',
      canvasNoise: 'Noise (Hash offset)',
      audioNoise: 'Enabled (+0.00002db)',
      fonts: ['SF Pro Text', 'Helvetica Neue', 'Arial', 'Geneva']
    },

    proxy: {
      enabled: true,
      type: 'HTTP',
      ip: '185.220.101.5',
      port: '8080',
      username: '',
      password: '',
      location: 'Frankfurt, DE',
      timezone: 'Europe/Berlin',
      lat: 50.1109,
      lng: 8.6821,
      webrtc: 'Proxy IP'
    },

    storage: {
      cookiesCount: 128,
      localStorageKeys: 34,
      hasSession: true
    }
  },
  {
    id: 'prof-3',
    name: 'iPhone 15 Mobile Profile',
    group: 'Mobile Testing',
    tags: ['Mobile Safari', 'iOS', 'TikTok Ads'],
    status: 'stopped',
    lastLaunched: '2026-07-23 14:00',
    
    os: 'iOS 17',
    browser: 'Safari 17.2',
    useragent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/605.1.15',
    
    resolution: {
      preset: '390x844 (iPhone 15)',
      width: 390,
      height: 844,
      devicePixelRatio: 3
    },
    
    hardware: {
      cpuCores: 6,
      memoryGb: 6,
      webGlVendor: 'Apple Inc.',
      webGlRenderer: 'Apple GPU (A17 Pro)',
      canvasNoise: 'Noise (Hash offset)',
      audioNoise: 'Enabled',
      fonts: ['SF Pro Display', 'SF Pro Text']
    },

    proxy: {
      enabled: true,
      type: 'HTTP',
      ip: '172.56.21.90',
      port: '8000',
      username: 'mobile_res',
      password: '••••••••',
      location: 'London, UK',
      timezone: 'Europe/London',
      lat: 51.5074,
      lng: -0.1278,
      webrtc: 'Proxy IP'
    },

    storage: {
      cookiesCount: 15,
      localStorageKeys: 4,
      hasSession: false
    }
  },
  {
    id: 'prof-4',
    name: 'Ubuntu Linux Stealth Bot',
    group: 'Automation',
    tags: ['Puppeteer', 'Python', 'Headless Spoof'],
    status: 'stopped',
    lastLaunched: '2026-07-21 09:20',
    
    os: 'Linux Ubuntu',
    browser: 'Firefox 125',
    useragent: 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0',
    
    resolution: {
      preset: '1366x768',
      width: 1366,
      height: 768,
      devicePixelRatio: 1
    },
    
    hardware: {
      cpuCores: 4,
      memoryGb: 8,
      webGlVendor: 'Mesa/X.org',
      webGlRenderer: 'Mesa Intel(R) UHD Graphics 620 (KBL GT2)',
      canvasNoise: 'Block Noise',
      audioNoise: 'Disabled',
      fonts: ['DejaVu Sans', 'Liberation Sans', 'Ubuntu']
    },

    proxy: {
      enabled: false,
      type: 'DIRECT',
      ip: '127.0.0.1',
      port: '',
      username: '',
      password: '',
      location: 'Localhost / Direct',
      timezone: 'UTC',
      lat: 0,
      lng: 0,
      webrtc: 'Real IP'
    },

    storage: {
      cookiesCount: 3,
      localStorageKeys: 0,
      hasSession: false
    }
  }
];

export const RESOLUTION_PRESETS = [
  { name: '1920x1080 (FHD Standard)', width: 1920, height: 1080, dpr: 1 },
  { name: '2560x1440 (2K QHD Display)', width: 2560, height: 1440, dpr: 1.25 },
  { name: '3840x2160 (4K UHD Retina)', width: 3840, height: 2160, dpr: 2 },
  { name: '1366x768 (Standard Laptop)', width: 1366, height: 768, dpr: 1 },
  { name: '1440x900 (MacBook Air)', width: 1440, height: 900, dpr: 2 },
  { name: '1536x864 (Windows Laptop)', width: 1536, height: 864, dpr: 1.25 },
  { name: '390x844 (iPhone 15 / 14)', width: 390, height: 844, dpr: 3 },
  { name: '412x915 (Google Pixel 8)', width: 412, height: 915, dpr: 2.6 },
  { name: '834x1194 (iPad Pro 11")', width: 834, height: 1194, dpr: 2 }
];

export const GPU_VENDOR_RENDERERS = [
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 Direct3D11 vs_5_0 ps_5_0)' },
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0)' },
  { vendor: 'Apple Inc.', renderer: 'Apple M3 Max' },
  { vendor: 'Apple Inc.', renderer: 'Apple M2 Ultra' },
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon RX 7900 XT Direct3D11 vs_5_0 ps_5_0)' },
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0)' }
];
