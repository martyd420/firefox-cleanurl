# CleanURL

A Firefox extension that removes or replaces tracking parameters from URLs before navigation.

## Features

- Strips common tracking parameters (UTM, gclid, fbclid, msclkid, and many more) automatically
- Three modes per parameter: **remove**, **replace with a fixed value**, or **randomize**
- Wildcard patterns (`utm_*`, `*clid`, `*track*`) for bulk matching
- Domain exceptions — skip cleaning on specific sites (subdomains included)
- Session and lifetime counters shown in the popup badge
- Fully configurable via the options page

## Installation

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

## License

MIT
