# CleanURL

A Firefox extension that removes or replaces tracking parameters from URLs before navigation.

## Features

- Strips common tracking parameters (UTM, gclid, fbclid, msclkid, and many more) automatically
- Three modes per parameter: **remove**, **replace with a fixed value**, or **randomize**
- Cleans tracking params hiding in the URL fragment too (`#utm_source=…` and SPA `#/route?utm_source=…`)
- Wildcard patterns (`utm_*`, `*clid`, `*track*`) for bulk matching
- Domain exceptions — skip cleaning on specific sites (subdomains included)
- Session and lifetime counters shown in the popup badge
- Fully configurable via the options page

## Installation

### From addons.mozilla.org (recommended)

**<https://addons.mozilla.org/cs/firefox/addon/cleanurl/>**

### From source (development)

1. Clone or download this repository.
2. Open Firefox and go to `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on** and select `manifest.json`.

## Usage

Click the toolbar icon to enable/disable the extension or open the settings page.

In **Settings** you can:
- Change the action for any parameter (remove / replace / random)
- Add custom parameters or wildcard patterns
- Add domains to the exception list
- Reset to the built-in default parameter list

## Privacy & permissions

CleanURL is built for people who care about privacy and security, so it is
designed around **data minimization** and the **least privilege** possible:

- **No data collection, no telemetry, no network calls.** Everything runs
  locally in your browser. The add-on declares `data_collection_permissions:
  none` to Mozilla. Your settings and counters live only in your own browser's
  local storage.
- **No accounts, no remote config, no analytics.**

It requests only the four permissions that are strictly required for its core
job — removing tracking parameters *before* a request leaves your browser:

| Permission | Why it is needed |
|---|---|
| `webRequest` | See the URL of an outgoing navigation so trackers can be detected |
| `webRequestBlocking` | Redirect to the cleaned URL *before* the request is sent — this is the whole point of the add-on |
| `storage` | Persist your parameter list, domain exceptions and counters locally |
| `<all_urls>` | Tracking parameters appear on any site, so cleaning has to be able to run anywhere |

**Permissions we will never request.** To keep the trust model simple and
auditable, CleanURL will not ask for high-risk permissions that aren't needed
for cleaning URLs — including `clipboardWrite`/`clipboardRead`, `cookies`,
`history`, `bookmarks`, `downloads`, or `nativeMessaging`. If a future feature
can only be built by adding such a permission, the feature is dropped or
redesigned rather than weakening this guarantee.

## Development

No build step is required to load the add-on, but tooling is included:

```sh
npm install      # one-time: installs web-ext + eslint
npm test         # run the node:test suite (pure cleaning logic)
npm run lint     # web-ext lint (validates the extension)
npm run build    # package into web-ext-artifacts/
npm start        # launch a temporary Firefox with the add-on loaded
```

The side-effect-free logic (URL cleaning, pattern matching, validation) lives in
`shared.js` and is covered by `tests/clean.test.js`.

## License

MIT
