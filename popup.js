function setCounter(el, before, count, after) {
  el.textContent = "";
  el.appendChild(document.createTextNode(before));
  const span = document.createElement("span");
  span.textContent = count;
  el.appendChild(span);
  el.appendChild(document.createTextNode(after));
}

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
    browser.storage.local.get([STORAGE_KEY_ENABLED, STORAGE_KEY_PARAMS]),
    browser.runtime.sendMessage({ type: "getStats" }).catch(() => ({ totalCleaned: 0 })),
  ]);

  const en = data[STORAGE_KEY_ENABLED] !== false;
  toggle.checked = en;

  const params = data[STORAGE_KEY_PARAMS] || DEFAULT_PARAMS;
  const active  = params.length;

  if (en) {
    setCounter(status, "Tracking ", active, " parameters");
  } else {
    status.textContent = "Extension is disabled";
  }

  const n = stats.totalCleaned;
  if (n > 0) setCounter(statusCleaned, "Cleaned ", n, " parameters since start");
  else statusCleaned.textContent = "";

  const lt = stats.lifetimeCleaned;
  if (lt > 0) setCounter(statusLifetime, "Total ", lt, " parameters since install");
  else statusLifetime.textContent = "";
}

toggle.addEventListener("change", async () => {
  await browser.storage.local.set({ [STORAGE_KEY_ENABLED]: toggle.checked });
  await render();
});

render();
