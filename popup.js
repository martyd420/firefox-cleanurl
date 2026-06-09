const toggle          = document.getElementById("toggle");
const status          = document.getElementById("status");
const statusCleaned   = document.getElementById("status-cleaned");
const statusLifetime  = document.getElementById("status-lifetime");
const optionsLink     = document.getElementById("options-link");

optionsLink.addEventListener("click", e => {
  e.preventDefault();
  browser.runtime.openOptionsPage();
  window.close();
});

async function render() {
  const [data, stats] = await Promise.all([
    browser.storage.local.get(["cleanurl_enabled", "cleanurl_params"]),
    browser.runtime.sendMessage({ type: "getStats" }).catch(() => ({ totalCleaned: 0 })),
  ]);

  const en = data.cleanurl_enabled !== false;
  toggle.checked = en;

  const params = data.cleanurl_params || DEFAULT_PARAMS;
  const active  = params.filter(p => p.mode !== "off").length;

  status.innerHTML = en
    ? `Tracking <span>${active}</span> parameters`
    : `Extension is disabled`;

  const n = stats.totalCleaned;
  statusCleaned.innerHTML = n > 0
    ? `Cleaned <span>${n}</span> parameters since start`
    : "";

  const lt = stats.lifetimeCleaned;
  statusLifetime.innerHTML = lt > 0
    ? `Total <span>${lt}</span> parameters since install`
    : "";
}

toggle.addEventListener("change", async () => {
  await browser.storage.local.set({ cleanurl_enabled: toggle.checked });
  await render();
});

render();
