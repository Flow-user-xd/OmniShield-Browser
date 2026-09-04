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
  targetArch = ((cfg.webglRenderer && cfg.webglRenderer.includes('Apple')) || (cfg.webglVendor && cfg.webglVendor.includes('Apple'))) ? 'arm' : 'x86';
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

const chromeM = ua.match(/(?:Chrome|CriOS)\/(\d+)\.([\d.]+)/);
const chromeMajor = chromeM ? chromeM[1] : '150';
const chromeFull = chromeM ? `${chromeMajor}.${chromeM[2]}` : '150.0.0.0';

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
        { header: 'Sec-CH-UA-Architecture', operation: 'set', value: `"${targetArch}"` },
        { header: 'Sec-CH-UA', operation: 'set', value: `"Chromium";v="${chromeMajor}", "Google Chrome";v="${chromeMajor}", "Not_A Brand";v="24"` },
        { header: 'Sec-CH-UA-Full-Version', operation: 'set', value: `"${chromeFull}"` },
        { header: 'Sec-CH-UA-Full-Version-List', operation: 'set', value: `"Chromium";v="${chromeFull}", "Google Chrome";v="${chromeFull}", "Not_A Brand";v="24.0.0.0"` },
        { header: 'Sec-CH-UA-Bitness', operation: 'set', value: '"64"' }
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

const acceptLang = cfg.acceptLanguage || (cfg.locale ? `${cfg.locale},en;q=0.9` : '');
if (acceptLang) {
  headerRules[0].action.requestHeaders.push({
    header: 'Accept-Language',
    operation: 'set',
    value: acceptLang
  });
}

function updateRules() {
  if (!chrome.declarativeNetRequest || !chrome.declarativeNetRequest.getDynamicRules) return;
  try {
    chrome.declarativeNetRequest.getDynamicRules(oldRules => {
      if (chrome.runtime.lastError) {
        console.warn('[OmniShield SW] getDynamicRules:', chrome.runtime.lastError.message);
        return;
      }
      const oldIds = (oldRules || []).map(r => r.id);
      chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: oldIds.length > 0 ? oldIds : [1],
        addRules: headerRules
      }, () => {
        if (chrome.runtime.lastError) {
          console.warn('[OmniShield SW] updateDynamicRules:', chrome.runtime.lastError.message);
        }
      });
    });
  } catch (err) {
    console.warn('[OmniShield SW] Failed to update dynamic rules:', err);
  }
}

chrome.runtime.onInstalled.addListener(updateRules);
updateRules();

// =========================================================================
// OmniShield Smart Omnibox Search Engine Resolver
// =========================================================================
// In Ungoogled Chromium, address bar search queries without a scheme default
// to 'http://{searchTerms}/', causing queries to fail with DNS errors.
// This resolver intercepts omnibox search queries and routes them seamlessly
// to Google Search, restoring the natural, normal browser search experience.

const KNOWN_TLDS = new Set([
  'com', 'org', 'net', 'edu', 'gov', 'mil', 'int',
  'io', 'co', 'ai', 'dev', 'app', 'xyz', 'info', 'biz', 'me', 'tv', 'cc',
  'in', 'uk', 'us', 'ca', 'au', 'de', 'fr', 'jp', 'cn', 'ru', 'br', 'nl',
  'se', 'no', 'fi', 'es', 'it', 'ch', 'at', 'dk', 'pl', 'cz', 'eu', 'asia',
  'online', 'site', 'tech', 'store', 'shop', 'blog', 'live', 'club', 'space',
  'pro', 'guru', 'link', 'click', 'cloud', 'vip', 'fun', 'top', 'work',
  'agency', 'group', 'company', 'email', 'world', 'today', 'news', 'life',
  'sh', 'gg', 'to', 'ly', 'so', 'fm', 'ms', 'is', 'pw', 'ws', 'im', 'icu'
]);

function isOmniboxSearchQuery(urlStr) {
  if (!urlStr || !urlStr.startsWith('http://')) return { isSearch: false };

  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname;

    // 1. Never redirect localhost, local network IPs, or local automation domains (.test, .example, etc.)
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1' ||
        host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.test') ||
        host.endsWith('.example') || host.endsWith('.invalid') || host.endsWith('.localhost')) {
      return { isSearch: false };
    }
    // IPv4 check
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) {
      return { isSearch: false };
    }
    // Explicit port specified (e.g. localhost:8080 or 192.168.1.1:8080)
    if (parsed.port && parsed.port !== '80') {
      return { isSearch: false };
    }

    // Only inspect requests with empty or root path
    if (parsed.pathname !== '/' && parsed.pathname !== '') {
      return { isSearch: false };
    }

    const rawHostAndPath = urlStr.replace(/^http:\/\//, '').replace(/\/$/, '');
    const decoded = decodeURIComponent(rawHostAndPath).trim();

    // 2. Spaces or search punctuation -> definitely a search query
    if (decoded.includes(' ') || decoded.includes('+') || decoded.includes('?') || decoded.includes('!') || decoded.includes('"') || decoded.includes("'")) {
      return { isSearch: true, query: decoded };
    }

    // 3. Single word without any dot -> definitely a search query (e.g. "cats", "weather", "cricket", "youtube")
    if (!host.includes('.')) {
      return { isSearch: true, query: decoded };
    }

    // 4. Contains dot: check if last part is a recognized TLD
    const parts = host.split('.');
    const tld = parts[parts.length - 1].toLowerCase();
    if (!KNOWN_TLDS.has(tld)) {
      return { isSearch: true, query: decoded };
    }

    return { isSearch: false };
  } catch (err) {
    const raw = urlStr.replace(/^http:\/\//, '').replace(/\/$/, '');
    return { isSearch: true, query: decodeURIComponent(raw) };
  }
}

function getSearchEngineUrl(query) {
  const engine = (cfg.searchEngine || 'duckduckgo').toLowerCase();
  const q = encodeURIComponent(query);
  if (engine === 'google') {
    return `https://www.google.com/search?q=${q}`;
  } else if (engine === 'bing') {
    return `https://www.bing.com/search?q=${q}`;
  } else {
    // DuckDuckGo: Privacy-first, zero CAPTCHAs, proxy-friendly!
    return `https://duckduckgo.com/?q=${q}`;
  }
}

if (chrome.webNavigation && chrome.webNavigation.onBeforeNavigate) {
  chrome.webNavigation.onBeforeNavigate.addListener((details) => {
    if (details.frameId !== 0) return; // Top-level tab navigation only

    // 1. Google "Unusual traffic" (google.com/sorry) Automatic CAPTCHA Bypass:
    // If Google flags the proxy/network IP and serves a reCAPTCHA block,
    // automatically extract the user's query and route to DuckDuckGo!
    if (details.url && details.url.includes('google.com/sorry/index')) {
      try {
        const parsed = new URL(details.url);
        const continueUrl = parsed.searchParams.get('continue');
        if (continueUrl) {
          const contParsed = new URL(continueUrl);
          const query = contParsed.searchParams.get('q');
          if (query) {
            console.log('[OmniShield] Google flagged IP with CAPTCHA block, auto-recovering to DuckDuckGo:', query);
            chrome.tabs.update(details.tabId, { url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}` });
            return;
          }
        }
      } catch (e) { }
    }

    // 2. Natural Omnibox Search Queries:
    const { isSearch, query } = isOmniboxSearchQuery(details.url);
    if (isSearch && query) {
      console.log('[OmniShield] Seamlessly resolving search query:', query);
      const targetUrl = getSearchEngineUrl(query);
      chrome.tabs.update(details.tabId, { url: targetUrl });
    }
  });

  chrome.webNavigation.onErrorOccurred.addListener((details) => {
    if (details.frameId !== 0) return;
    if (details.url && details.url.startsWith('http://')) {
      if (details.error === 'net::ERR_NAME_NOT_RESOLVED') {
        const raw = details.url.replace(/^http:\/\//, '').replace(/\/$/, '');
        const query = decodeURIComponent(raw).trim();
        if (query && query !== 'localhost' && query !== '127.0.0.1' && !/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(query)) {
          console.log('[OmniShield] DNS resolution fallback to Search:', query);
          const targetUrl = getSearchEngineUrl(query);
          chrome.tabs.update(details.tabId, { url: targetUrl });
        }
      }
    }
  });
}
