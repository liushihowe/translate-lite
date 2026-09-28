/* ============================================================
   main.js — 入口:事件绑定与翻译流程编排
   ============================================================ */

import { streamChat } from "./api.js";
import { t, applyTranslations } from "./i18n.js";
import {
  getState,
  setState,
  setPrefs,
  currentModel,
  DEFAULT_PROMPT,
} from "./state.js";
import {
  renderModelMenu,
  renderProviderList,
  openProviderForm,
  addModelRow,
  collectProviderForm,
  toast,
} from "./ui.js";

const $ = (id) => document.getElementById(id);

const sourceEl = $("source");
const resultEl = $("result");
const sourceReasoningEl = $("source-reasoning");
const sourceReasoningBodyEl = $("source-reasoning-body");
const reasoningEl = $("reasoning");
const reasoningBodyEl = $("reasoning-body");
const metaEl = $("result-meta");
const sourceMetaEl = $("source-meta");
const countEl = $("char-count");
const translateBtn = $("btn-translate");
const reverseBtn = $("btn-translate-reverse");
const modelBtn = $("model-btn");
const modelNameEl = $("model-name");
const modelMenuEl = $("model-menu");
const settingsEl = $("settings");
const providerFormEl = $("provider-form");
const providerListEl = $("provider-list");
const promptInput = $("prompt-input");

let controller = null;
let activeFromRight = false;

init();

function init() {
  applyTranslations();
  refreshModelButton();
  promptInput.value = getState().prefs.prompt;
  updateCount();
  bindEvents();
}

function bindEvents() {
  translateBtn.addEventListener("click", () => doTranslate(false));
  reverseBtn.addEventListener("click", () => doTranslate(true));
  sourceEl.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") doTranslate(false);
  });
  resultEl.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") doTranslate(true);
  });
  sourceEl.addEventListener("input", () => {
    updateCount();
    sourceMetaEl.textContent = "";
    sourceReasoningEl.hidden = true;
  });
  resultEl.addEventListener("input", () => {
    metaEl.textContent = "";
    reasoningEl.hidden = true;
  });

  $("btn-clear").addEventListener("click", () => {
    sourceEl.value = "";
    updateCount();
    sourceMetaEl.textContent = "";
    sourceReasoningEl.hidden = true;
    sourceEl.focus();
  });
  $("btn-clear-result").addEventListener("click", () => {
    resultEl.value = "";
    metaEl.textContent = "";
    reasoningEl.hidden = true;
    resultEl.focus();
  });

  $("btn-copy-source").addEventListener("click", () => copyText(sourceEl.value));
  $("btn-copy").addEventListener("click", () => copyText(resultEl.value));

  /* ----- 模型菜单 ----- */
  modelBtn.addEventListener("click", () => toggleModelMenu(modelMenuEl.hidden));
  document.addEventListener("click", (e) => {
    if (
      !modelMenuEl.hidden &&
      !modelMenuEl.contains(e.target) &&
      !modelBtn.contains(e.target)
    ) {
      toggleModelMenu(false);
    }
  });
  modelMenuEl.addEventListener("click", (e) => {
    const item = e.target.closest(".menu-item[data-model]");
    if (!item) return;
    setPrefs({ providerId: item.dataset.pid, modelId: item.dataset.model });
    refreshModelButton();
    toggleModelMenu(false);
  });

  /* ----- 设置面板 ----- */
  $("open-settings").addEventListener("click", openSettings);
  $("close-settings").addEventListener("click", () => settingsEl.close());
  settingsEl.addEventListener("click", (e) => {
    if (e.target === settingsEl) settingsEl.close();
  });

  promptInput.addEventListener("change", () => setPrefs({ prompt: promptInput.value }));

  /* ----- 提供商 CRUD ----- */
  $("add-provider").addEventListener("click", () => openProviderForm(providerFormEl));
  $("pf-add-model").addEventListener("click", () => addModelRow($("pf-models")));
  $("pf-models").addEventListener("click", (e) => {
    if (e.target.closest("[data-remove-model]")) e.target.closest(".model-row").remove();
  });
  providerListEl.addEventListener("click", (e) => {
    const editBtn = e.target.closest("[data-edit]");
    const delBtn = e.target.closest("[data-del]");
    if (editBtn) {
      const p = getState().providers.find((x) => x.id === editBtn.dataset.edit);
      if (p) openProviderForm(providerFormEl, p);
    } else if (delBtn) {
      const p = getState().providers.find((x) => x.id === delBtn.dataset.del);
      if (p && confirm(t("deleteConfirm", { name: p.name }))) {
        setState((s) => ({ providers: s.providers.filter((x) => x.id !== p.id) }));
        if (getState().prefs.providerId === p.id) setPrefs({ providerId: null, modelId: null });
        renderProviderList(providerListEl);
        refreshModelButton();
        toast(t("deleted"));
      }
    }
  });

  $("pf-save").addEventListener("click", () => {
    const data = collectProviderForm(providerFormEl);
    if (!data) return;
    setState((s) => {
      const exists = s.providers.some((p) => p.id === data.id);
      return {
        providers: exists
          ? s.providers.map((p) => (p.id === data.id ? data : p))
          : [...s.providers, data],
      };
    });
    providerFormEl.close();
    renderProviderList(providerListEl);
    refreshModelButton();
    toast(t("saved"));
  });
  $("pf-cancel").addEventListener("click", () => providerFormEl.close());
  providerFormEl.addEventListener("click", (e) => {
    if (e.target === providerFormEl) providerFormEl.close();
  });
  $("pf-key-visible").addEventListener("change", (e) => {
    $("pf-key").type = e.target.checked ? "text" : "password";
  });

  /* ----- 主题 ----- */
  $("theme-toggle").addEventListener("click", () => {
    const root = document.documentElement;
    const dark = root.dataset.theme === "dark";
    root.dataset.theme = dark ? "light" : "dark";
    setPrefs({ theme: dark ? "light" : "dark" });
  });
}

async function copyText(text) {
  if (!text) return toast(t("noContent"));
  try {
    await navigator.clipboard.writeText(text);
    toast(t("copied"));
  } catch {
    toast(t("copyFailed"));
  }
}

/* ================= 翻译流程 ================= */

async function doTranslate(fromRight) {
  if (controller) {
    if (activeFromRight === fromRight) controller.abort();
    return;
  }

  const inputEl = fromRight ? resultEl : sourceEl;
  const outputEl = fromRight ? sourceEl : resultEl;
  const outputMetaEl = fromRight ? sourceMetaEl : metaEl;
  const outputReasoningEl = fromRight ? sourceReasoningEl : reasoningEl;
  const outputReasoningBodyEl = fromRight ? sourceReasoningBodyEl : reasoningBodyEl;
  const inputReasoningEl = fromRight ? reasoningEl : sourceReasoningEl;
  const text = inputEl.value.trim();
  if (!text) {
    toast(t("inputRequired"));
    inputEl.focus();
    return;
  }

  const cur = currentModel();
  if (!cur) {
    toast(t("configureModel"));
    openSettings();
    return;
  }

  const request = new AbortController();
  const previousText = outputEl.value;
  controller = request;
  activeFromRight = fromRight;
  setTranslating(true, fromRight);
  outputEl.readOnly = true;
  outputMetaEl.textContent = "";
  inputReasoningEl.hidden = true;
  outputReasoningEl.hidden = true;
  outputReasoningEl.open = true;
  outputReasoningBodyEl.textContent = "";

  const template = getState().prefs.prompt || DEFAULT_PROMPT;
  const user = template.includes("{{text}}")
    ? template.replaceAll("{{text}}", text)
    : `${template}\n\n${text}`;

  const t0 = performance.now();
  let acc = "";

  try {
    await streamChat({
      endpointUrl: cur.provider.endpointUrl,
      apiKey: cur.provider.apiKey,
      model: cur.model,
      extra: cur.extra, // 模型级附加参数(思考档位等),未配置则为空
      user,
      signal: request.signal,
      onDelta: (d) => {
        acc += d;
        outputEl.value = acc;
        outputEl.scrollTop = outputEl.scrollHeight;
        if (fromRight) updateCount();
      },
      onReasoning: (r) => {
        outputReasoningEl.hidden = false;
        outputReasoningBodyEl.textContent += r;
      },
    });

    outputReasoningEl.open = false;
    outputMetaEl.textContent = acc
      ? t("modelTime", { model: cur.name, time: Math.round(performance.now() - t0) })
      : t("noResponse");
  } catch (e) {
    if (e.name === "AbortError") {
      outputMetaEl.textContent = t("stopped");
    } else {
      outputEl.value = previousText;
      if (fromRight) updateCount();
      outputReasoningEl.hidden = true;
      outputMetaEl.textContent = t("requestFailed");
      toast(e.message);
    }
  } finally {
    outputEl.readOnly = false;
    controller = null;
    setTranslating(false, fromRight);
  }
}

function setTranslating(on, fromRight) {
  for (const [button, label, isRight] of [
    [translateBtn, "translateRight", false],
    [reverseBtn, "translateLeft", true],
  ]) {
    const active = on && isRight === fromRight;
    button.disabled = on && !active;
    button.classList.toggle("loading", active);
    button.querySelector(".btn-label").textContent = t(active ? "stop" : label);
    button.querySelector("kbd").style.display = active ? "none" : "";
  }
}

/* ================= 杂项 UI ================= */

function toggleModelMenu(show) {
  if (show) {
    renderModelMenu(modelMenuEl);
    const r = modelBtn.getBoundingClientRect();
    modelMenuEl.style.left = `${Math.max(8, r.left)}px`;
    modelMenuEl.style.top = `${r.bottom + 8}px`;
    modelMenuEl.hidden = false;
  } else {
    modelMenuEl.hidden = true;
  }
}

function openSettings() {
  renderProviderList(providerListEl);
  settingsEl.showModal();
}

function refreshModelButton() {
  const cur = currentModel();
  modelNameEl.textContent = cur ? cur.name : t("chooseModel");
  modelNameEl.classList.toggle("unset", !cur);
}

function updateCount() {
  countEl.textContent = t("count", { count: sourceEl.value.length });
}
