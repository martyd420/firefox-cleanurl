# CleanURL – improvement plan

Status: **Phases 1, 2 and 4 are done and shipped** (bug fixes, cleaning robustness, tests + tooling). **The AMO listing is approved and live** at https://addons.mozilla.org/cs/firefox/addon/cleanurl/ — Phase 3 (functional features) is now unblocked. Phase 5 (Manifest V3) remains future work. Items are ordered by priority; each phase can be shipped on its own.

**Next action: resume with Phase 3.**

## Guiding principle: maximum security and privacy

CleanURL targets privacy- and security-conscious users. Every decision therefore
favors **data minimization** and the **least privilege** possible:

- No data collection, no telemetry, no network calls — everything runs locally.
- We request only the 4 essential permissions (`webRequest`, `webRequestBlocking`,
  `storage`, `<all_urls>`); each is required for the core function.
- **We will never request high-risk permissions that aren't essential for cleaning
  URLs** — in particular `clipboardWrite`/`clipboardRead`, `cookies`, `history`,
  `bookmarks`, `downloads`, `nativeMessaging`. If a feature can't be built without
  such a permission, we drop or redesign the feature instead.

## 1. Bug fixes (quick, do now)

- [x] **Dead `mode !== "off"` code in the popup** (`popup.js:32`) — no `off` mode exists anywhere, so the "Tracking N parameters" counter always counts every parameter. Either remove the condition, or (better) actually implement an `off` mode — see item 3.1.
- [x] **Wrong comment in `params.js`** — `mc_eid` is Mailchimp (e-mail ID), not Facebook/Meta. Move it next to `mc_cid`.
- [x] **Duplicate parameters in a URL** (`background.js:67–91`) — `searchParams.delete(key)` removes all occurrences at once, but the snapshot iterates each occurrence separately, so `count` is incremented for already-deleted entries. Statistics then overcount. Fix: count actually-removed occurrences (e.g. via a `Set` of processed keys).
- [x] **Lifetime counter lost on browser close** — the 2s debounce (`background.js:129–133`) means the last write can be lost. Add a flush in `window.onbeforeunload` / `browser.runtime.onSuspend` (on a persistent page, beforeunload is enough).

## 2. Cleaning robustness

- [x] **Parameters in the URL fragment** — trackers also appear after `#` (`example.com/#utm_source=x`, typically SPA routers). Add optional cleaning of `url.hash` when it has the shape of a query string.
- [x] **Side effects of URL re-serialization** — `URLSearchParams.toString()` changes encoding (`+`/`%20`, escaping order) even for parameters that aren't being cleaned. Minimize: if `count === 0` return nothing (already done), and consider building the query manually so untouched parameters aren't rewritten. → Cleaner rewritten to operate on raw segments; untouched parameters are not rewritten.
- [x] **Multiple asterisks in a pattern** — `matchesPattern` only supports prefix/suffix/contains. Either extend support (convert to a RegExp with escaping), or validate in options and reject patterns like `a*b*c` with an error message. → Validated in options (`isValidParamName`).
- [x] **Validate a new parameter in options** (`options.js:142`) — today anything passes, including spaces, `=`, `&`. Add simple validation (`/^[\w.*~-]+$/`) and an error message.
- [x] **Allowlist: domain validation** — today any string can be added. Validate the domain shape, normalize IDN (punycode) via `new URL("http://" + raw).hostname`.

## 3. Functional improvements

> **Unblocked — the AMO listing is approved**
> (https://addons.mozilla.org/cs/firefox/addon/cleanurl/). Note that items
> 3.3/3.4 would add new permissions (`activeTab`, `menus`), which triggers a new
> review when an update is submitted.

- [ ] **3.1 Per-parameter disable (`off` mode)** — instead of deleting a row, allow a parameter to be temporarily disabled. Add to `cleanUrl` (skip), to the options select, and fix the popup counter (follows from item 1).
- [ ] **3.2 Export / import settings** — JSON file with parameters + allowlist. Two buttons in options, validation on import.
- [ ] **3.3 "Clean current URL" in the popup** — a button that takes the active tab's URL, cleans it, and copies it to the clipboard (sharing tracking-free links even from allowlisted sites). ~~Requires `activeTab` + `clipboardWrite`.~~ → **We do not request `clipboardWrite` (see guiding principle).** Implement only if copying can work via a user gesture without the permission (button click → `navigator.clipboard.writeText` / `execCommand`); otherwise drop the feature or replace it with just displaying the cleaned URL for manual copying.
- [ ] **3.4 Context menu "Copy clean link"** — right-click a link → cleaned URL to the clipboard. `menus` permission. → Same condition as 3.3 — no `clipboardWrite`; if it can't be done reliably without it, drop it.
- [ ] **3.5 Per-tab badge** — today the badge shows the global session counter. More useful is the number of parameters cleaned for the current tab (`setBadgeText({ tabId })`), keeping the global numbers in the popup.
- [ ] **3.6 Extend the default list** — candidates: `mkt_tok` (Marketo), `vero_id`, `oly_enc_id`/`oly_anon_id` (Omeda), `s_cid` (Adobe), `dclid` (DoubleClick), `srsltid` (Google Merchant), `li_fat_id` (LinkedIn), `sccid` (Snapchat), `rtid`. Beware of parameters that break functionality (`ref` on some sites) — don't add those globally.
- [ ] **3.7 Recent-cleanings log** — a small ring buffer (e.g. 50 entries: time, domain, removed parameters) shown in options. Helps debug false positives. Keep it in memory only (no disk writes = no new data collection).

## 4. Code quality and tooling

- [x] **Unit tests for the pure logic** — `cleanUrl`, `matchesPattern`, `buildParamMap`, `isDomainAllowed` are pure functions. Extract them into a shared module and test via `node:test` (no dependencies). Tests: duplicate parameters, wildcards, replace/random loops, IDN domains, fragments. → `shared.js` + `tests/clean.test.js` (19 tests).
- [x] **`web-ext` workflow** — add `package.json` with `web-ext lint` and `web-ext build` (replaces the manual `cleanurl.xpi`, now gitignored). Optionally GitHub Actions for lint. → `package.json` + `web-ext-config.cjs`; lint passes with 0 warnings. (GitHub Actions skipped for now — the `.gitignore` rule `.**` ignores `.github/`.)
- [x] **ESLint** — minimal config with the `webextensions` env. → `eslint.config.js` (flat config), lint is clean.
- [x] **Merge duplicate constants** — storage keys are constants in `background.js` but string literals in `popup.js`/`options.js` (`"cleanurl_params"`). Move them into a shared file (e.g. extend `params.js` → `shared.js`). → All in `shared.js`.
- [x] **Drop `.idea/` from git** — IDE files into `.gitignore`, `git rm -r --cached .idea`. → `.idea/` is no longer tracked (covered by the `.**` rule).

## 5. Future: Manifest V3 (low priority, but keep an eye on it)

Firefox still supports MV2 and `webRequestBlocking` also works in Firefox MV3, so there's no rush. When needed:

- [ ] Migrate to `manifest_version: 3` (`action` instead of `browser_action`, host permissions separately).
- [ ] Intermediate step available now: `persistent: false` (event page) — Firefox supports it in MV2, saves memory. Requires moving the session counter (`totalCleaned`) to `storage.session` and removing the debounce logic that depends on long-lived state.
- [ ] The `declarativeNetRequest` alternative is **not suitable** for replace/random modes (DNR can't do dynamic values) — stay with blocking webRequest, which Firefox keeps in MV3.

## 6. Publishing to AMO

- [ ] Version 1.1.0 after phases 1–2, with a changelog. (Manifest is still 1.0.0.)
- [x] `web-ext sign` / submit to addons.mozilla.org — submitted and **approved**; the listing is live at https://addons.mozilla.org/cs/firefox/addon/cleanurl/.
- [x] README: privacy section (all local, no telemetry) and a link to the AMO listing. → Privacy & permissions section added; the AMO link is now the recommended installation method in the README.

## UI notes

Keep any popup/options changes in the existing dark style; no glow/neon effects, border-radius max 3px (the current code already complies).
