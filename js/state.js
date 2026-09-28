/* ============================================================
   state.js — 全局状态与 localStorage 持久化
   ============================================================ */

const LS_KEY = "monet-translate:v2";

/** 内置默认提示词:中英互译,端到端,模型自行判断方向 */
export const DEFAULT_PROMPT = `You are a Chinese-English translation expert. Your task is to translate the text inside <translate_input>.

<translate_input>
{{text}}
</translate_input>

Target language: The opposite language of the text inside <translate_input>.`;

function defaults() {
  return {
    providers: [], // {id, name, endpointUrl, apiKey, models:[{id, name, extra}]}
    prefs: {
      theme: "system", // light | dark | system
      providerId: null,
      modelId: null,
      prompt: DEFAULT_PROMPT,
    },
  };
}

function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return defaults();
    const parsed = JSON.parse(raw);
    return {
      ...defaults(),
      ...parsed,
      prefs: { ...defaults().prefs, ...(parsed.prefs || {}) },
    };
  } catch {
    return defaults();
  }
}

let state = load();

export function getState() {
  return state;
}

export function setState(patch) {
  if (typeof patch === "function") patch = patch(state);
  state = { ...state, ...patch };
  save();
}

export function setPrefs(patch) {
  state.prefs = { ...state.prefs, ...patch };
  save();
}

function save() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("保存失败:", e);
  }
}

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** 当前选中的 {provider, model, name, extra} ,未配置返回 null。
 *  extra 是该模型配置的附加请求参数(思考档位等),默认空对象 = 不思考。 */
export function currentModel() {
  const { providerId, modelId } = state.prefs;
  const p = state.providers.find((x) => x.id === providerId);
  if (!p) return null;
  const m = p.models.find((x) => x.id === modelId);
  if (!m) return null;
  return { provider: p, model: m.id, name: m.name, extra: m.extra || {} };
}
