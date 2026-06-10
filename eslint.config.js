"use strict";

// Minimal flat config with the globals the extension relies on (WebExtensions
// + the browser environment). No external plugin packages required.
const extensionGlobals = {
  browser: "readonly",
  window: "readonly",
  document: "readonly",
  console: "readonly",
  crypto: "readonly",
  URL: "readonly",
  URLSearchParams: "readonly",
  Uint8Array: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  confirm: "readonly",
  module: "writable",
};

// Names defined in shared.js and consumed by the other scripts loaded after it
// in the same page/global scope. ESLint lints files in isolation, so they have
// to be declared here for the consumers.
const sharedApi = {
  STORAGE_KEY_PARAMS: "readonly",
  STORAGE_KEY_ENABLED: "readonly",
  STORAGE_KEY_ALLOWLIST: "readonly",
  STORAGE_KEY_LIFETIME: "readonly",
  DEFAULT_PARAMS: "readonly",
  randomString: "readonly",
  matchesPattern: "readonly",
  compileParams: "readonly",
  lookupCfg: "readonly",
  cleanQuery: "readonly",
  cleanFragment: "readonly",
  cleanUrl: "readonly",
  isDomainAllowed: "readonly",
  isValidParamName: "readonly",
  normalizeDomain: "readonly",
};

module.exports = [
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: extensionGlobals,
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": "warn",
    },
  },
  {
    // background.js, popup.js and options.js use the shared.js API.
    files: ["background.js", "popup.js", "options.js"],
    languageOptions: { globals: sharedApi },
  },
  {
    files: ["tests/**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: { require: "readonly", module: "writable", process: "readonly" },
    },
  },
];
