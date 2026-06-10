// Shared, side-effect-free logic used by background.js, popup.js and options.js.
// Loaded as a classic <script> in the extension (top-level const/function
// bindings are visible to scripts loaded after it) and required directly by the
// node:test suite via the module.exports shim at the bottom.

// ── Storage keys ────────────────────────────────────────────────────────────
const STORAGE_KEY_PARAMS    = "cleanurl_params";
const STORAGE_KEY_ENABLED   = "cleanurl_enabled";
const STORAGE_KEY_ALLOWLIST = "cleanurl_allowlist";
const STORAGE_KEY_LIFETIME  = "cleanurl_lifetime_cleaned";

// ── Default tracking parameter definitions ──────────────────────────────────
// mode: "remove" | "replace" | "random"; value: used only when mode "replace".
const DEFAULT_PARAMS = [
  // UTM (Google Analytics / generic)
  { name: "utm_source",          mode: "remove", value: "" },
  { name: "utm_medium",          mode: "remove", value: "" },
  { name: "utm_campaign",        mode: "remove", value: "" },
  { name: "utm_term",            mode: "remove", value: "" },
  { name: "utm_content",         mode: "remove", value: "" },
  { name: "utm_id",              mode: "remove", value: "" },
  { name: "utm_source_platform", mode: "remove", value: "" },
  { name: "utm_creative_format", mode: "remove", value: "" },
  { name: "utm_marketing_tactic",mode: "remove", value: "" },
  // Google Ads
  { name: "gclid",   mode: "remove", value: "" },
  { name: "gclsrc",  mode: "remove", value: "" },
  { name: "wbraid",  mode: "remove", value: "" },
  { name: "gbraid",  mode: "remove", value: "" },
  // Facebook / Meta
  { name: "fbclid",  mode: "remove", value: "" },
  // Microsoft / Bing
  { name: "msclkid", mode: "remove", value: "" },
  // Twitter / X
  { name: "twclid",  mode: "remove", value: "" },
  // TikTok
  { name: "ttclid",  mode: "remove", value: "" },
  // Pinterest
  { name: "epik",    mode: "remove", value: "" },
  // Instagram
  { name: "igshid",  mode: "remove", value: "" },
  // Yandex
  { name: "yclid",     mode: "remove", value: "" },
  { name: "_openstat", mode: "remove", value: "" },
  // Mailchimp
  { name: "mc_cid",  mode: "remove", value: "" },  // campaign ID
  { name: "mc_eid",  mode: "remove", value: "" },  // recipient e-mail ID
  // HubSpot
  { name: "_hsenc",  mode: "remove", value: "" },
  { name: "_hsmi",   mode: "remove", value: "" },
  { name: "hsa_acc", mode: "remove", value: "" },
  { name: "hsa_cam", mode: "remove", value: "" },
  { name: "hsa_grp", mode: "remove", value: "" },
  { name: "hsa_ad",  mode: "remove", value: "" },
  { name: "hsa_src", mode: "remove", value: "" },
  { name: "hsa_tgt", mode: "remove", value: "" },
  { name: "hsa_kw",  mode: "remove", value: "" },
  { name: "hsa_mt",  mode: "remove", value: "" },
  { name: "hsa_net", mode: "remove", value: "" },
  { name: "hsa_ver", mode: "remove", value: "" },
];

// ── Random value generator ──────────────────────────────────────────────────
function randomString(len = 12) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  for (const b of buf) out += chars[b % chars.length];
  return out;
}

// ── Pattern matching ─────────────────────────────────────────────────────────
// Supports prefix (utm_*), suffix (*clid), contains (*track*) and exact (*).
function matchesPattern(pattern, name) {
  if (pattern === "*") return true;
  const sw = pattern.startsWith("*");
  const ew = pattern.endsWith("*");
  if (sw && ew) return name.includes(pattern.slice(1, -1));
  if (sw)       return name.endsWith(pattern.slice(1));
  if (ew)       return name.startsWith(pattern.slice(0, -1));
  return name === pattern;
}

// Compiles a param list into fast-lookup form: an exact-match Map plus a list of
// wildcard entries (those whose name contains "*").
function compileParams(params) {
  const exact = new Map();      // lowercase name -> {mode, value}
  const wildcards = [];         // [{pattern, cfg}]
  for (const p of params) {
    const key = p.name.toLowerCase();
    const cfg = { mode: p.mode, value: p.value };
    if (key.includes("*")) wildcards.push({ pattern: key, cfg });
    else                    exact.set(key, cfg);
  }
  return { exact, wildcards };
}

function lookupCfg(compiled, lkey) {
  const hit = compiled.exact.get(lkey);
  if (hit) return hit;
  for (const w of compiled.wildcards) {
    if (matchesPattern(w.pattern, lkey)) return w.cfg;
  }
  return null;
}

// ── Query / fragment cleaning ─────────────────────────────────────────────────

function decodeToken(s) {
  try { return decodeURIComponent(s.replace(/\+/g, " ")); }
  catch { return s; }
}

// Cleans one raw query string (the text after "?" or after "#" when the
// fragment carries a query). Untouched segments are kept byte-for-byte so their
// original encoding (e.g. %20 vs +) is never rewritten. Duplicate occurrences of
// a matched key are collapsed and counted once. Returns { query, count }.
function cleanQuery(raw, compiled, randomFn = randomString) {
  if (!raw) return { query: raw, count: 0 };

  const parsed = raw.split("&").map(seg => {
    if (seg === "") return { seg, lkey: null, cfg: null };
    const eq = seg.indexOf("=");
    const rawKey = eq === -1 ? seg : seg.slice(0, eq);
    const rawVal = eq === -1 ? "" : seg.slice(eq + 1);
    const lkey = decodeToken(rawKey).toLowerCase();
    return { seg, rawKey, value: decodeToken(rawVal), lkey, cfg: lookupCfg(compiled, lkey) };
  });

  // For replace mode we need to know whether ANY occurrence of a key differs
  // from the target (and whether there were duplicates to collapse).
  const valuesByKey = new Map();
  for (const it of parsed) {
    if (!it.cfg) continue;
    if (!valuesByKey.has(it.lkey)) valuesByKey.set(it.lkey, []);
    valuesByKey.get(it.lkey).push(it.value);
  }

  let count = 0;
  const out = [];
  const handled = new Set();   // matched lkeys already decided
  for (const it of parsed) {
    if (it.lkey === null) continue;             // drop empty segment
    if (!it.cfg) { out.push(it.seg); continue; } // untouched -> verbatim

    if (it.cfg.mode === "remove") {
      if (!handled.has(it.lkey)) { handled.add(it.lkey); count++; }
      continue;                                  // drop every occurrence
    }

    // replace / random: emit once at the first occurrence, drop the rest.
    if (handled.has(it.lkey)) continue;
    handled.add(it.lkey);

    if (it.cfg.mode === "replace") {
      const vals = valuesByKey.get(it.lkey);
      const changed = vals.length > 1 || vals.some(v => v !== it.cfg.value);
      if (changed) count++;
      out.push(it.rawKey + "=" + encodeURIComponent(it.cfg.value));
    } else if (it.cfg.mode === "random") {
      count++;
      out.push(it.rawKey + "=" + encodeURIComponent(randomFn()));
    }
  }

  return { query: out.join("&"), count };
}

// Cleans tracking params hiding in the URL fragment: either the whole fragment
// is a query string (#utm_source=x) or an SPA route carries one (#/path?utm=x).
function cleanFragment(hash, compiled, randomFn = randomString) {
  if (!hash) return { hash, count: 0 };

  const qIdx = hash.indexOf("?");
  if (qIdx !== -1) {
    const before = hash.slice(0, qIdx);
    const r = cleanQuery(hash.slice(qIdx + 1), compiled, randomFn);
    if (r.count === 0) return { hash, count: 0 };
    return { hash: r.query ? before + "?" + r.query : before, count: r.count };
  }

  // Treat the whole fragment as a query only when it looks like key=value pairs.
  if (/^[^=&?#]+=/.test(hash)) {
    const r = cleanQuery(hash, compiled, randomFn);
    if (r.count === 0) return { hash, count: 0 };
    return { hash: r.query, count: r.count };
  }

  return { hash, count: 0 };
}

// Cleans a full URL. Returns { url, count } or null when nothing changed.
function cleanUrl(rawUrl, compiled, randomFn = randomString) {
  let url;
  try { url = new URL(rawUrl); } catch { return null; }

  let count = 0;

  const s = cleanQuery(url.search.replace(/^\?/, ""), compiled, randomFn);
  if (s.count > 0) { url.search = s.query; count += s.count; }

  const f = cleanFragment(url.hash.replace(/^#/, ""), compiled, randomFn);
  if (f.count > 0) { url.hash = f.hash; count += f.count; }

  return count > 0 ? { url: url.toString(), count } : null;
}

// ── Allowlist ──────────────────────────────────────────────────────────────
// Matches an exact domain AND all of its subdomains.
function isDomainAllowed(hostname, allowlist) {
  const h = hostname.toLowerCase();
  return allowlist.some(d => h === d || h.endsWith("." + d));
}

// ── Input validation (used by the options page) ──────────────────────────────
// A valid name is a bare parameter (letters, digits, _ . ~ -) optionally with a
// single leading and/or trailing "*", or "*" on its own. Matches what
// matchesPattern supports and rejects "=", "&", spaces and multi-* patterns.
function isValidParamName(name) {
  return name === "*" || /^\*?[\w.~-]+\*?$/.test(name);
}

// Normalizes user input to a bare hostname (IDN -> punycode via the URL parser)
// so the stored form matches what background.js compares against. Returns null
// for anything that isn't a plausible domain.
function normalizeDomain(input) {
  const raw = input.trim().toLowerCase()
    .replace(/^https?:\/\//, "")   // strip protocol if pasted
    .replace(/\/.*$/, "");         // strip path
  if (!raw) return null;
  let host;
  try { host = new URL("http://" + raw).hostname; } catch { return null; }
  if (!host.includes(".") || !/^[a-z0-9.-]+$/.test(host)) return null;
  return host;
}

// node:test entry point — ignored in the browser (module is undefined there).
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    STORAGE_KEY_PARAMS, STORAGE_KEY_ENABLED, STORAGE_KEY_ALLOWLIST, STORAGE_KEY_LIFETIME,
    DEFAULT_PARAMS, randomString, matchesPattern, compileParams, lookupCfg,
    cleanQuery, cleanFragment, cleanUrl, isDomainAllowed, isValidParamName, normalizeDomain,
  };
}
