// Keeps dev-only files out of the packaged extension produced by `web-ext build`.
module.exports = {
  ignoreFiles: [
    "package.json",
    "package-lock.json",
    "node_modules",
    "tests",
    "eslint.config.js",
    "web-ext-config.cjs",
    "plan-improvements.md",
  ],
};
