const STORAGE_KEY_PARAMS    = "cleanurl_params";
const STORAGE_KEY_ENABLED   = "cleanurl_enabled";
const STORAGE_KEY_ALLOWLIST = "cleanurl_allowlist";
const STORAGE_KEY_LIFETIME  = "cleanurl_lifetime_cleaned";
const PENDING_TTL = 5000;

let enabled        = true;
let paramMap       = new Map();  // lowercase exact name → {mode, value}
let wildcardList   = [];         // [{pattern, cfg}] for entries containing *
let allowlist      = [];         // string[] of domains where cleaning is skipped
let totalCleaned   = 0;          // session counter (resets on browser restart)
let lifetimeCleaned = 0;         // persistent counter (survives restarts)
let lifetimeSaveTimer = null;

function randomString(len = 12) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  for (const b of buf) out += chars[b % chars.length];
  return out;
}

// Supports prefix (utm_*), suffix (*clid), contains (*track*), and exact (*) wildcards.
function matchesPattern(pattern, name) {
  if (pattern === "*") return true;
  const sw = pattern.startsWith("*");
  const ew = pattern.endsWith("*");
  if (sw && ew) return name.includes(pattern.slice(1, -1));
  if (sw)       return name.endsWith(pattern.slice(1));
  if (ew)       return name.startsWith(pattern.slice(0, -1));
  return name === pattern;
}

function buildParamMap(params) {
  paramMap = new Map();
  wildcardList = [];
  for (const p of params) {
    const key = p.name.toLowerCase();
    const cfg = { mode: p.mode, value: p.value };
    if (key.includes("*")) wildcardList.push({ pattern: key, cfg });
    else                    paramMap.set(key, cfg);
  }
}

// Matches exact domain AND all its subdomains.
function isDomainAllowed(hostname) {
  const h = hostname.toLowerCase();
  return allowlist.some(d => h === d || h.endsWith("." + d));
}

function updateBadge() {
  const text = totalCleaned > 0
    ? (totalCleaned > 9999 ? "9999+" : String(totalCleaned))
    : "";
  browser.browserAction.setBadgeText({ text });
  browser.browserAction.setBadgeBackgroundColor({ color: "#4a9c59" });
  browser.browserAction.setBadgeTextColor({ color: "#ffffff" });
}

function cleanUrl(rawUrl) {
  let url;
  try { url = new URL(rawUrl); } catch { return null; }

  let count = 0;
  // Iterate a snapshot of params so deletes don't affect the iteration.
  for (const [key, currentVal] of [...url.searchParams]) {
    const lkey = key.toLowerCase();

    let cfg = paramMap.get(lkey);
    if (!cfg) {
      for (const w of wildcardList) {
        if (matchesPattern(w.pattern, lkey)) { cfg = w.cfg; break; }
      }
    }
    if (!cfg) continue;

    if (cfg.mode === "remove") {
      url.searchParams.delete(key);
      count++;
    } else if (cfg.mode === "replace") {
      // Only act if value differs — prevents redirect loop on already-replaced URLs.
      if (currentVal !== cfg.value) {
        url.searchParams.set(key, cfg.value);
        count++;
      }
    } else if (cfg.mode === "random") {
      url.searchParams.set(key, randomString());
      count++;
    }
  }
  return count > 0 ? { url: url.toString(), count } : null;
}

// Map<url, expiryMs> — skip URLs we just produced as redirect targets
// so random-mode replacements don't loop. TTL guards against stale entries
// from prefetches or aborted navigations.
const pendingRedirects = new Map();

function onBeforeRequest(details) {
  if (!enabled) return {};

  try {
    if (isDomainAllowed(new URL(details.url).hostname)) return {};
  } catch { return {}; }

  const now = Date.now();

  if (pendingRedirects.size > 100) {
    for (const [u, exp] of pendingRedirects) {
      if (now > exp) pendingRedirects.delete(u);
    }
  }

  if (pendingRedirects.has(details.url)) {
    const exp = pendingRedirects.get(details.url);
    pendingRedirects.delete(details.url);
    if (now <= exp) return {};
    // Expired entry — fall through and process normally.
  }

  const result = cleanUrl(details.url);
  if (result) {
    pendingRedirects.set(result.url, now + PENDING_TTL);
    totalCleaned   += result.count;
    lifetimeCleaned += result.count;
    updateBadge();
    // Debounce storage write — batches rapid navigations into one write.
    clearTimeout(lifetimeSaveTimer);
    lifetimeSaveTimer = setTimeout(
      () => browser.storage.local.set({ [STORAGE_KEY_LIFETIME]: lifetimeCleaned }),
      2000
    );
    return { redirectUrl: result.url };
  }
  return {};
}

browser.runtime.onMessage.addListener(msg => {
  if (msg.type === "getStats") return Promise.resolve({ totalCleaned, lifetimeCleaned });
});

function registerListener() {
  if (!browser.webRequest.onBeforeRequest.hasListener(onBeforeRequest)) {
    browser.webRequest.onBeforeRequest.addListener(
      onBeforeRequest,
      { urls: ["<all_urls>"], types: ["main_frame", "sub_frame"] },
      ["blocking"]
    );
  }
}

function unregisterListener() {
  if (browser.webRequest.onBeforeRequest.hasListener(onBeforeRequest)) {
    browser.webRequest.onBeforeRequest.removeListener(onBeforeRequest);
  }
}

async function loadSettings() {
  const data = await browser.storage.local.get([
    STORAGE_KEY_PARAMS, STORAGE_KEY_ENABLED, STORAGE_KEY_ALLOWLIST, STORAGE_KEY_LIFETIME
  ]);
  enabled         = data[STORAGE_KEY_ENABLED] !== false;
  allowlist       = data[STORAGE_KEY_ALLOWLIST] || [];
  lifetimeCleaned = data[STORAGE_KEY_LIFETIME]  || 0;
  buildParamMap(data[STORAGE_KEY_PARAMS] || DEFAULT_PARAMS);
  if (enabled) registerListener(); else unregisterListener();
}

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (STORAGE_KEY_ENABLED in changes) {
    enabled = changes[STORAGE_KEY_ENABLED].newValue !== false;
    if (enabled) registerListener(); else unregisterListener();
  }
  if (STORAGE_KEY_PARAMS in changes) {
    buildParamMap(changes[STORAGE_KEY_PARAMS].newValue || DEFAULT_PARAMS);
  }
  if (STORAGE_KEY_ALLOWLIST in changes) {
    allowlist = changes[STORAGE_KEY_ALLOWLIST].newValue || [];
  }
});

loadSettings();
