let params   = [];
let allowlist = [];
let saveTimer = null;

const body        = document.getElementById("params-body");
const checkAll    = document.getElementById("check-all");
const saveBtn     = document.getElementById("save-btn");
const savedMsg    = document.getElementById("saved-msg");
const newParam    = document.getElementById("new-param");
const addBtn      = document.getElementById("add-btn");
const newDomain   = document.getElementById("new-domain");
const addDomainBtn= document.getElementById("add-domain-btn");
const domainList  = document.getElementById("domain-list");
const paramError  = document.getElementById("param-error");
const domainError = document.getElementById("domain-error");

// ── Persistence ──────────────────────────────────────────────────────────────

async function save() {
  await browser.storage.local.set({
    [STORAGE_KEY_PARAMS]:    params,
    [STORAGE_KEY_ALLOWLIST]: allowlist,
  });
  savedMsg.classList.add("show");
  setTimeout(() => savedMsg.classList.remove("show"), 1500);
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 1000);
}

saveBtn.addEventListener("click", () => { clearTimeout(saveTimer); save(); });

// ── Param table ───────────────────────────────────────────────────────────────

function modeLabel(m) {
  return { remove: "Remove", replace: "Replace with text", random: "Random text" }[m] || m;
}

function renderParams() {
  body.innerHTML = "";
  params.forEach((p, i) => {
    const tr = document.createElement("tr");

    const tdCheck = document.createElement("td");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.dataset.i = i;
    tdCheck.appendChild(cb);
    tr.appendChild(tdCheck);

    const tdName = document.createElement("td");
    tdName.className = "name";
    tdName.textContent = p.name;
    tr.appendChild(tdName);

    const tdMode = document.createElement("td");
    const sel = document.createElement("select");
    ["remove", "replace", "random"].forEach(m => {
      const opt = document.createElement("option");
      opt.value = m;
      opt.textContent = modeLabel(m);
      opt.selected = p.mode === m;
      sel.appendChild(opt);
    });
    sel.addEventListener("change", () => {
      params[i].mode = sel.value;
      renderParams();
      scheduleSave();
    });
    tdMode.appendChild(sel);
    tr.appendChild(tdMode);

    const tdVal = document.createElement("td");
    tdVal.className = "value-cell";
    const inp = document.createElement("input");
    inp.type = "text";
    inp.value = p.value || "";
    inp.placeholder = p.mode === "random" ? "(generated automatically)" : "value";
    inp.disabled = p.mode !== "replace";
    inp.addEventListener("input", () => { params[i].value = inp.value; scheduleSave(); });
    tdVal.appendChild(inp);
    tr.appendChild(tdVal);

    const tdDel = document.createElement("td");
    const delBtn = document.createElement("button");
    delBtn.className = "del-btn";
    delBtn.textContent = "✕";
    delBtn.title = "Remove parameter";
    delBtn.addEventListener("click", () => {
      params.splice(i, 1);
      renderParams();
      scheduleSave();
    });
    tdDel.appendChild(delBtn);
    tr.appendChild(tdDel);

    body.appendChild(tr);
  });
}

function checkedIndices() {
  return [...body.querySelectorAll("input[type=checkbox]:checked")]
    .map(cb => parseInt(cb.dataset.i));
}

checkAll.addEventListener("change", () => {
  body.querySelectorAll("input[type=checkbox]")
    .forEach(cb => { cb.checked = checkAll.checked; });
});

document.getElementById("select-all").addEventListener("click", () => {
  body.querySelectorAll("input[type=checkbox]").forEach(cb => { cb.checked = true; });
  checkAll.checked = true;
});

document.getElementById("set-remove").addEventListener("click", () => {
  checkedIndices().forEach(i => { params[i].mode = "remove"; });
  renderParams(); scheduleSave();
});

document.getElementById("set-random").addEventListener("click", () => {
  checkedIndices().forEach(i => { params[i].mode = "random"; });
  renderParams(); scheduleSave();
});

document.getElementById("del-selected").addEventListener("click", () => {
  const indices = new Set(checkedIndices());
  params = params.filter((_, i) => !indices.has(i));
  renderParams(); scheduleSave();
});

document.getElementById("reset-defaults").addEventListener("click", () => {
  if (confirm("Reset the default parameter list? Your changes will be lost.")) {
    params = DEFAULT_PARAMS.map(p => ({ ...p }));
    renderParams(); scheduleSave();
  }
});

addBtn.addEventListener("click", addParam);
newParam.addEventListener("keydown", e => { if (e.key === "Enter") addParam(); });
newParam.addEventListener("input", () => clearError(paramError));

function addParam() {
  const name = newParam.value.trim().toLowerCase();
  if (!name) return;
  if (!isValidParamName(name)) {
    showError(paramError, newParam,
      "Use letters, digits, _ . ~ - and at most one leading/trailing *.");
    return;
  }
  if (params.some(p => p.name === name)) {
    showError(paramError, newParam, "That parameter is already in the list.");
    return;
  }
  clearError(paramError);
  params.push({ name, mode: "remove", value: "" });
  newParam.value = "";
  renderParams();
  scheduleSave();
}

// ── Domain allowlist ──────────────────────────────────────────────────────────

function renderDomains() {
  domainList.innerHTML = "";
  allowlist.forEach((domain, i) => {
    const chip = document.createElement("div");
    chip.className = "domain-chip";
    chip.textContent = domain;
    const del = document.createElement("button");
    del.className = "del-btn";
    del.textContent = "✕";
    del.title = "Remove";
    del.addEventListener("click", () => {
      allowlist.splice(i, 1);
      renderDomains();
      scheduleSave();
    });
    chip.appendChild(del);
    domainList.appendChild(chip);
  });
}

addDomainBtn.addEventListener("click", addDomain);
newDomain.addEventListener("keydown", e => { if (e.key === "Enter") addDomain(); });
newDomain.addEventListener("input", () => clearError(domainError));

function addDomain() {
  if (!newDomain.value.trim()) return;
  const host = normalizeDomain(newDomain.value);
  if (!host) {
    showError(domainError, newDomain, "Enter a valid domain, e.g. example.com.");
    return;
  }
  if (allowlist.includes(host)) {
    showError(domainError, newDomain, "That domain is already in the list.");
    return;
  }
  clearError(domainError);
  allowlist.push(host);
  newDomain.value = "";
  renderDomains();
  scheduleSave();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function flash(el) {
  el.style.borderColor = "#c05050";
  setTimeout(() => { el.style.borderColor = ""; }, 1200);
}

function showError(msgEl, inputEl, text) {
  msgEl.textContent = text;
  flash(inputEl);
}

function clearError(msgEl) {
  msgEl.textContent = "";
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  const data = await browser.storage.local.get([
    STORAGE_KEY_PARAMS, STORAGE_KEY_ALLOWLIST
  ]);
  params    = (data[STORAGE_KEY_PARAMS]    || DEFAULT_PARAMS).map(p => ({ ...p }));
  allowlist = (data[STORAGE_KEY_ALLOWLIST] || []).slice();
  renderParams();
  renderDomains();
}

init();
