// Storage keys, DEFAULT_PARAMS and the pure cleaning logic live in shared.js,
// which the manifest loads before this script.

const PENDING_TTL = 5000;

let enabled         = true;
let compiled        = compileParams([]); // { exact, wildcards }
let allowlist       = [];                // string[] of domains where cleaning is skipped
let totalCleaned    = 0;                 // session counter (resets on browser restart)
let lifetimeCleaned = 0;                 // persistent counter (survives restarts)
let lifetimeSaveTimer = null;

function updateBadge() {
  const text = totalCleaned > 0
    ? (totalCleaned > 9999 ? "9999+" : String(totalCleaned))
    : "";
  browser.browserAction.setBadgeText({ text });
  browser.browserAction.setBadgeBackgroundColor({ color: "#4a9c59" });
  browser.browserAction.setBadgeTextColor({ color: "#ffffff" });
}

// Map<url, expiryMs> — skip URLs we just produced as redirect targets
// so random-mode replacements don't loop. TTL guards against stale entries
// from prefetches or aborted navigations.
const pendingRedirects = new Map();

function onBeforeRequest(details) {
  if (!enabled) return {};

  try {
    if (isDomainAllowed(new URL(details.url).hostname, allowlist)) return {};
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

  const result = cleanUrl(details.url, compiled);
  if (result) {
    pendingRedirects.set(result.url, now + PENDING_TTL);
    totalCleaned    += result.count;
    lifetimeCleaned += result.count;
    updateBadge();
    // Debounce storage write — batches rapid navigations into one write.
    clearTimeout(lifetimeSaveTimer);
    lifetimeSaveTimer = setTimeout(flushLifetime, 2000);
    return { redirectUrl: result.url };
  }
  return {};
}

// Writes the pending lifetime counter immediately, cancelling any debounce.
function flushLifetime() {
  clearTimeout(lifetimeSaveTimer);
  lifetimeSaveTimer = null;
  return browser.storage.local.set({ [STORAGE_KEY_LIFETIME]: lifetimeCleaned });
}

// A debounced write may still be pending when the browser closes; flush it so
// the last navigations aren't lost from the lifetime total.
window.addEventListener("beforeunload", () => {
  if (lifetimeSaveTimer !== null) flushLifetime();
});

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
  compiled        = compileParams(data[STORAGE_KEY_PARAMS] || DEFAULT_PARAMS);
  if (enabled) registerListener(); else unregisterListener();
}

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (STORAGE_KEY_ENABLED in changes) {
    enabled = changes[STORAGE_KEY_ENABLED].newValue !== false;
    if (enabled) registerListener(); else unregisterListener();
  }
  if (STORAGE_KEY_PARAMS in changes) {
    compiled = compileParams(changes[STORAGE_KEY_PARAMS].newValue || DEFAULT_PARAMS);
  }
  if (STORAGE_KEY_ALLOWLIST in changes) {
    allowlist = changes[STORAGE_KEY_ALLOWLIST].newValue || [];
  }
});

loadSettings();
