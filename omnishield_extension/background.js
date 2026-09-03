// OmniShield Anti-Detect Service Worker - DeclarativeNetRequest Network Header Modification
try {
  importScripts('config.js');
} catch (e) {
  console.error('[OmniShield Service Worker] Failed to import config.js:', e);
}

const cfg = self.__OMNI_CONFIG || {};
const ua = cfg.userAgent || '';

let targetOSName = 'Windows';
let targetPlatformVersion = '10.0.0';
let targetArch = 'x86';
let targetModel = '';
let isMobile = false;

if (ua.includes('iPhone') || ua.includes('iPad') || ua.includes('OS 17') || ua.includes('OS 16')) {
  targetOSName = 'iOS';
  targetPlatformVersion = '17.2';
  targetArch = 'arm';
  targetModel = 'iPhone';
  isMobile = true;
} else if (ua.includes('Macintosh') || ua.includes('Mac OS X')) {
  targetOSName = 'macOS';
  targetPlatformVersion = '14.2.0';
  targetArch = 'x86';
  targetModel = '';
  isMobile = false;
} else if (ua.includes('Android')) {
  targetOSName = 'Android';
  const verM = ua.match(/Android ([\d.]+)/);
  const modM = ua.match(/Android [\d.]+;\s*([^;)]+)\)/);
  targetPlatformVersion = verM ? verM[1] : '10';
  targetModel = modM ? modM[1].trim() : '';
  targetArch = 'arm';
  isMobile = ua.includes('Mobile');
}

const headerRules = [
  {
    id: 1,
    priority: 1,
    action: {
      type: 'modifyHeaders',
      requestHeaders: [
        { header: 'Sec-CH-UA-Platform', operation: 'set', value: `"${targetOSName}"` },
        { header: 'Sec-CH-UA-Mobile', operation: 'set', value: isMobile ? '?1' : '?0' },
        { header: 'Sec-CH-UA-Platform-Version', operation: 'set', value: `"${targetPlatformVersion}"` },
        { header: 'Sec-CH-UA-Model', operation: 'set', value: `"${targetModel}"` },
        { header: 'Sec-CH-UA-Architecture', operation: 'set', value: `"${targetArch}"` }
      ]
    },
    condition: {
      urlFilter: '*',
      resourceTypes: ['main_frame', 'sub_frame', 'stylesheet', 'script', 'image', 'font', 'object', 'xmlhttprequest', 'ping', 'csp_report', 'media', 'websocket', 'other']
    }
  }
];

if (ua) {
  headerRules[0].action.requestHeaders.push({
    header: 'User-Agent',
    operation: 'set',
    value: ua
  });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [1],
    addRules: headerRules
  });
});

chrome.declarativeNetRequest.updateDynamicRules({
  removeRuleIds: [1],
  addRules: headerRules
});
