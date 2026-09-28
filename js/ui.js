/* ============================================================
   ui.js — DOM 渲染片段(菜单 / 设置面板 / toast)
   ============================================================ */

import { getState, currentModel, uid } from "./state.js";
import { t } from "./i18n.js";

export function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/* ---------- toast ---------- */

let toastTimer = null;
export function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
}

/* ---------- 模型弹出菜单 ---------- */

export function renderModelMenu(menuEl) {
  const { providers } = getState();
  const cur = currentModel();

  let html = "";
  for (const p of providers) {
    if (!p.models.length) continue;
    html += `<div class="menu-group"><div class="menu-group-title">${esc(p.name)}</div>`;
    for (const m of p.models) {
      const active = cur && cur.provider.id === p.id && cur.model === m.id;
      const hasExtra = m.extra && Object.keys(m.extra).length > 0;
      html += `
        <button class="menu-item${active ? " active" : ""}" data-pid="${p.id}" data-model="${esc(m.id)}">
          <svg class="check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg>
          <span class="model-label" title="${esc(m.id)}">${esc(m.name)}</span>
          ${hasExtra ? `<span class="menu-badge" title="${esc(t("extraBadgeTitle"))}">${esc(t("extraBadge"))}</span>` : ""}
        </button>`;
    }
    html += `</div>`;
  }

  if (!html) {
    html = `<div class="menu-empty">${esc(t("menuEmpty"))}</div>`;
  }

  menuEl.innerHTML = html;
}

/* ---------- 设置:提供商列表 ---------- */

export function renderProviderList(listEl) {
  const { providers } = getState();
  if (!providers.length) {
    listEl.innerHTML = `<div class="empty-hint">${esc(t("providerEmpty"))}</div>`;
    return;
  }
  listEl.innerHTML = providers
    .map(
      (p) => `
      <div class="provider-row">
        <div class="provider-info">
          <b>${esc(p.name)}</b>
          <span class="provider-meta mono">${esc(p.endpointUrl)} · ${esc(t("providerModelCount", { count: p.models.length }))}</span>
        </div>
        <div class="provider-actions">
          <button class="ghost-btn small" data-edit="${p.id}">${esc(t("edit"))}</button>
          <button class="ghost-btn small danger" data-del="${p.id}">${esc(t("delete"))}</button>
        </div>
      </div>`
    )
    .join("");
}

/* ---------- 提供商表单(添加 / 编辑共用) ---------- */

export function openProviderForm(dialogEl, provider = null) {
  dialogEl.dataset.editing = provider ? provider.id : "";
  dialogEl.querySelector("#pf-title").textContent = t(provider ? "providerFormEdit" : "providerFormAdd");
  dialogEl.querySelector("#pf-name").value = provider?.name || "";
  dialogEl.querySelector("#pf-url").value = provider?.endpointUrl || "";
  dialogEl.querySelector("#pf-key").value = provider?.apiKey || "";
  const modelsEl = dialogEl.querySelector("#pf-models");
  modelsEl.replaceChildren();
  for (const model of provider?.models?.length ? provider.models : [{}]) {
    addModelRow(modelsEl, model);
  }
  dialogEl.querySelector("#pf-key-visible").checked = false;
  dialogEl.querySelector("#pf-key").type = "password";
  dialogEl.showModal();
}

export function addModelRow(modelsEl, model = {}) {
  let extraText = '{"enable_thinking":false}';
  if (model.extra !== undefined) {
    extraText = Object.keys(model.extra).length ? JSON.stringify(model.extra) : "";
  }
  modelsEl.insertAdjacentHTML("beforeend", `
    <div class="model-row">
      <label class="field">
        <span data-i18n="modelId">${esc(t("modelId"))}</span>
        <input type="text" class="mono" data-model-id placeholder="deepseek-chat" value="${esc(model.id || "")}">
      </label>
      <label class="field">
        <span data-i18n="displayName">${esc(t("displayName"))}</span>
        <input type="text" data-model-name placeholder="DeepSeek Chat" value="${esc(model.name || "")}">
      </label>
      <button type="button" class="ghost-btn small danger" data-remove-model data-i18n="removeModel">${esc(t("removeModel"))}</button>
      <label class="field model-extra">
        <span data-i18n="extraParams">${esc(t("extraParams"))}</span>
        <input type="text" class="mono" data-model-extra value="${esc(extraText)}">
      </label>
    </div>`);
}

/** 收集模型字段;额外参数以 JSON 对象并入请求体。 */
export function collectProviderForm(dialogEl) {
  const name = dialogEl.querySelector("#pf-name").value.trim();
  const endpointUrl = dialogEl.querySelector("#pf-url").value.trim();
  const apiKey = dialogEl.querySelector("#pf-key").value.trim();

  const models = [];
  const rows = dialogEl.querySelectorAll(".model-row");
  for (const [i, row] of rows.entries()) {
    const id = row.querySelector("[data-model-id]").value.trim();
    const modelName = row.querySelector("[data-model-name]").value.trim();
    const extraRaw = row.querySelector("[data-model-extra]").value.trim();

    if (!id) return toastError(t("requiredModelId", { number: i + 1 }));
    if (!modelName) return toastError(t("requiredDisplayName", { number: i + 1 }));
    if (models.some((model) => model.id === id)) return toastError(t("duplicateModelId", { id }));

    let extra = {};
    if (extraRaw) {
      try {
        extra = JSON.parse(extraRaw);
        if (typeof extra !== "object" || !extra || Array.isArray(extra)) throw 0;
      } catch {
        return toastError(t("invalidExtra", { number: i + 1 }));
      }
    }
    models.push({ id, name: modelName, extra });
  }

  if (!name) return toastError(t("requiredName"));
  if (!/^https?:\/\//.test(endpointUrl)) return toastError(t("invalidEndpoint"));
  if (!apiKey) return toastError(t("requiredKey"));
  if (!models.length) return toastError(t("requiredModels"));

  const id = dialogEl.dataset.editing || uid();
  return { id, name, endpointUrl, apiKey, models };
}

function toastError(message) {
  toast(message);
  return null;
}
