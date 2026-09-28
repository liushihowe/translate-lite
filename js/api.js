/* ============================================================
   api.js — OpenAI Chat Completions 流式调用(浏览器直连)
   ============================================================ */

/**
 * 流式对话。SSE 增量通过回调吐出,兼容思考模型:
 * DeepSeek / Qwen 等网关会把思考内容放在 delta.reasoning_content。
 *
 * @param {object} o
 * @param {string} o.endpointUrl 完整的 Chat Completions 接口地址
 * @param {string} o.apiKey
 * @param {string} o.model
 * @param {object} o.extra     并入 body 的附加参数(思考档位等)
 * @param {string} o.system    系统提示词
 * @param {string} o.user      用户输入
 * @param {AbortSignal} o.signal
 * @param {(text:string)=>void} o.onDelta      正文增量
 * @param {(text:string)=>void} o.onReasoning  思考过程增量(可选)
 */
export async function streamChat({ endpointUrl, apiKey, model, extra = {}, system, user, signal, onDelta, onReasoning }) {
  const resp = await fetch(endpointUrl, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      stream: true,
      messages: [
        ...(system ? [{ role: "system", content: system }] : []),
        { role: "user", content: user },
      ],
      ...extra,
    }),
  });

  if (!resp.ok || !resp.body) {
    let msg = `HTTP ${resp.status}`;
    const body = await resp.text();
    if (body) {
      try {
        const data = JSON.parse(body);
        msg = (typeof data?.error === "string" ? data.error : data?.error?.message)
          || data?.message || body;
      } catch {
        msg = body;
      }
    }
    throw new Error(msg);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  function handleLine(line) {
    if (!line.startsWith("data:")) return false;

    const data = line.slice(5).trim();
    if (data === "[DONE]") return true;

    let chunk;
    try {
      chunk = JSON.parse(data);
    } catch {
      return false;
    }

    if (chunk.error) {
      throw new Error(typeof chunk.error === "string" ? chunk.error : chunk.error.message || JSON.stringify(chunk.error));
    }

    const delta = chunk.choices?.[0]?.delta || {};
    if (delta.reasoning_content && onReasoning) onReasoning(delta.reasoning_content);
    if (delta.content) onDelta(delta.content);
    return false;
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (handleLine(line)) return;
    }
  }

  buf += decoder.decode();
  if (buf.trim()) handleLine(buf.trim());
}
