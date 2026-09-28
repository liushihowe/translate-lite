import zh from "./lang/zh.js";
import en from "./lang/en.js";

const language = /^zh(?:-|$)/i.test(navigator.language || "") ? "zh" : "en";
const messages = language === "zh" ? zh : en;

export function t(key, values = {}) {
  const message = messages[key];
  return message.replace(/\{(\w+)\}/g, (_, name) => values[name]);
}

export function applyTranslations() {
  for (const element of document.querySelectorAll("[data-i18n]")) {
    element.textContent = t(element.dataset.i18n);
  }
  for (const element of document.querySelectorAll("[data-i18n-placeholder]")) {
    element.placeholder = t(element.dataset.i18nPlaceholder);
  }
  for (const element of document.querySelectorAll("[data-i18n-title]")) {
    element.title = t(element.dataset.i18nTitle);
  }
  document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  document.title = t("pageTitle");
  document.querySelector('meta[name="description"]').content = t("description");
}
