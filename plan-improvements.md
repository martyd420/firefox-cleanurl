# CleanURL – plán vylepšení

Stav: návrh k diskusi. Položky jsou seřazené podle priority; každá fáze je samostatně dodatelná.

## 1. Opravy chyb (rychlé, udělat hned)

- [x] **Mrtvý kód `mode !== "off"` v popupu** (`popup.js:32`) — režim `off` nikde neexistuje, počítadlo „Tracking N parameters" tedy vždy počítá všechny parametry. Buď podmínku odstranit, nebo (lépe) režim `off` skutečně doimplementovat — viz bod 3.1.
- [x] **Špatný komentář v `params.js`** — `mc_eid` je Mailchimp (e-mail ID), ne Facebook/Meta. Přesunout k `mc_cid`.
- [x] **Duplicitní parametry v URL** (`background.js:67–91`) — `searchParams.delete(key)` smaže všechny výskyty najednou, ale snapshot iteruje každý výskyt zvlášť, takže `count` se navýší za už smazané položky. Statistiky pak nadhodnocují. Řešení: počítat skutečně odstraněné výskyty (např. přes `Set` zpracovaných klíčů).
- [x] **Ztráta lifetime počítadla při zavření prohlížeče** — debounce 2 s (`background.js:129–133`) znamená, že poslední zápis se může ztratit. Doplnit flush ve `window.onbeforeunload` / `browser.runtime.onSuspend` (na persistentní stránce stačí beforeunload).

## 2. Robustnost čištění

- [x] **Parametry ve fragmentu URL** — trackery se objevují i za `#` (`example.com/#utm_source=x`, typicky SPA routery). Přidat volitelné čištění `url.hash`, pokud má tvar query stringu.
- [x] **Vedlejší efekty re-serializace URL** — `URLSearchParams.toString()` mění encoding (`+`/`%20`, pořadí escapování) i u parametrů, kterých se čištění netýká. Minimalizovat: pokud `count === 0`, nic nevracet (už je), a zvážit ruční sestavení query, aby se nedotčené parametry nepřepisovaly. → Cleaner přepsán na práci s raw segmenty, nedotčené parametry se nepřepisují.
- [x] **Vícenásobné hvězdičky ve vzoru** — `matchesPattern` umí jen prefix/sufix/contains. Buď podporu rozšířit (převod na RegExp s escapováním), nebo v options validovat a vzory typu `a*b*c` odmítnout s hláškou. → Validace v options (`isValidParamName`).
- [x] **Validace nového parametru v options** (`options.js:142`) — dnes projde cokoli včetně mezer, `=`, `&`. Přidat jednoduchou validaci (`/^[\w.*~-]+$/`) a chybovou hlášku.
- [x] **Allowlist: validace domény** — dnes lze přidat libovolný řetězec. Validovat tvar domény, normalizovat IDN (punycode) přes `new URL("http://" + raw).hostname`.

## 3. Funkční vylepšení

> **Odloženo až po schválení na AMO.** Listing čeká na review
> (https://addons.mozilla.org/en-US/firefox/addon/cleanurl/). Body 3.3/3.4
> přidávají nové permissions (`clipboardWrite`, `activeTab`, `menus`), což může
> review prodloužit nebo restartovat. Realizovat až po schválení.

- [ ] **3.1 Per-parametr vypnutí (režim `off`)** — místo mazání řádku umožnit parametr dočasně vypnout. Doplnit do `cleanUrl` (přeskočit), do selectu v options a opravit počítadlo v popupu (návaznost na bod 1).
- [ ] **3.2 Export / import nastavení** — JSON soubor s parametry + allowlistem. Dvě tlačítka v options, validace při importu.
- [ ] **3.3 „Vyčistit aktuální URL" v popupu** — tlačítko, které vezme URL aktivního tabu, vyčistí ji a zkopíruje do schránky (sdílení odkazů bez trackingu i z webů v allowlistu). Vyžaduje permission `activeTab` + `clipboardWrite`.
- [ ] **3.4 Kontextové menu „Kopírovat čistý odkaz"** — pravý klik na odkaz → vyčištěná URL do schránky. Permission `menus`.
- [ ] **3.5 Per-tab badge** — dnes badge ukazuje globální session počítadlo. Užitečnější je počet vyčištěných parametrů pro aktuální tab (`setBadgeText({ tabId })`), globální čísla nechat v popupu.
- [ ] **3.6 Rozšíření výchozího seznamu** — kandidáti: `mkt_tok` (Marketo), `vero_id`, `oly_enc_id`/`oly_anon_id` (Omeda), `s_cid` (Adobe), `dclid` (DoubleClick), `srsltid` (Google Merchant), `li_fat_id` (LinkedIn), `sccid` (Snapchat), `rtid`. Pozor na parametry, které rozbíjejí funkčnost (`ref` u některých webů) — ty nepřidávat globálně.
- [ ] **3.7 Log posledních vyčištění** — malý kruhový buffer (např. 50 záznamů: čas, doména, odstraněné parametry) zobrazený v options. Pomáhá ladit falešné pozitivy. Držet jen v paměti (žádný zápis na disk = žádný nový sběr dat).

## 4. Kvalita kódu a tooling

- [x] **Unit testy čisté logiky** — `cleanUrl`, `matchesPattern`, `buildParamMap`, `isDomainAllowed` jsou čisté funkce. Vyčlenit je do sdíleného modulu a testovat přes `node:test` (bez závislostí). Testy: duplicitní parametry, wildcardy, smyčky replace/random, IDN domény, fragmenty. → `shared.js` + `tests/clean.test.js` (19 testů).
- [x] **`web-ext` workflow** — přidat `package.json` s `web-ext lint` a `web-ext build` (nahradí ruční tvorbu `cleanurl.xpi`, který je teď v gitignore). Volitelně GitHub Actions na lint. → `package.json` + `web-ext-config.cjs`; lint projde s 0 varováními. (GitHub Actions zatím vynecháno — `.gitignore` pravidlo `.**` ignoruje `.github/`.)
- [x] **ESLint** — minimální konfigurace s `webextensions` env. → `eslint.config.js` (flat config), lint je čistý.
- [x] **Sloučit duplicitní konstanty** — klíče storage jsou v `background.js` jako konstanty, ale v `popup.js`/`options.js` jako stringy (`"cleanurl_params"`). Přesunout do sdíleného souboru (např. rozšířit `params.js` → `shared.js`). → Vše v `shared.js`.
- [x] **Vyhodit `.idea/` z gitu** — IDE soubory do `.gitignore`, `git rm -r --cached .idea`. → `.idea/` už není trackováno (kryje pravidlo `.**`).

## 5. Budoucnost: Manifest V3 (nízká priorita, ale sledovat)

Firefox MV2 zatím podporuje a `webRequestBlocking` funguje i v Firefox MV3, takže nehoří. Až bude potřeba:

- [ ] Přechod na `manifest_version: 3` (`action` místo `browser_action`, host permissions zvlášť).
- [ ] Mezikrok hned teď: `persistent: false` (event page) — Firefox podporuje v MV2, ušetří paměť. Vyžaduje přesun session počítadla (`totalCleaned`) do `storage.session` a zrušení debounce logiky závislé na dlouhožijícím stavu.
- [ ] Alternativa `declarativeNetRequest` se **nehodí** pro režimy replace/random (DNR neumí dynamické hodnoty) — zůstat u blocking webRequest, který Firefox v MV3 zachovává.

## 6. Publikace na AMO (volitelné)

- [ ] Verze 1.1.0 po fázích 1–2, changelog.
- [ ] `web-ext sign` / submit na addons.mozilla.org — manifest už má `browser_specific_settings.gecko.id` a deklaraci o nesbírání dat, takže je připraveno.
- [ ] README: sekce o ochraně soukromí (vše lokálně, žádná telemetrie) a odkaz na AMO listing.

## Poznámky k UI

Případné úpravy popupu/options držet ve stávajícím tmavém stylu; žádné glow/neon efekty, border-radius max 3px (současný kód to splňuje).
