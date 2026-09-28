# End-to-End Translation · Chinese–English Intertranslation  

A purely static, zero-dependency, zero-build Chinese–English intertranslation web page. It connects directly to any **OpenAI Chat Completions–compatible API** from the browser, supports streaming output, and includes a thinking mode (disabled by default). Providers must specify the full chat completion endpoint URL.  

The new configuration uses independent local storage keys; previous settings will not be imported automatically. You need to re-add providers and models.  

The color scheme follows the Material You design system, with light and dark themes that either follow the system preference or can be switched manually.  

The interface follows the browser's default language: Chinese for `zh` locales and English otherwise (including when no language is available). UI strings live in `js/lang/zh.js` and `js/lang/en.js`.  

Both the left and right panels are editable:  
- Enter text in the left panel and click "Translate to Right".  
- Enter text in the right panel and click "Translate to Left".  

You can also translate by pressing `Ctrl+Enter` in the active input panel (`Cmd+Enter` on macOS). The "Copy" button in each panel copies the current content of that panel, including manually edited translations.  

---

## Supported Providers (Examples of Full API URLs)  

| Provider          | Full API URL                                                   | Model ID Example                  |  
|-------------------|----------------------------------------------------------------|-----------------------------------|  
| DeepSeek          | `https://api.deepseek.com/v1/chat/completions`                 | -                                 |  
| OpenAI            | `https://api.openai.com/v1/chat/completions`                   | `gpt-4o`, `gpt-3.5-turbo`         |  
| OpenRouter        | `https://openrouter.ai/api/v1/chat/completions`                | `mistralai/mistral-large`         |  

> *Note: Replace with your actual API keys or proxy domains if needed.*  

---

## Thinking Mode  

To enable thinking mode, add the following to your extra parameters:  
```json
{"enable_thinking": true}
```  
Other models may use:  
```json
{"reasoning_effort": "high"}
```  

---

## Intertranslation Principle  

Built-in system prompt (editable in Settings):  

```
You are a Chinese-English translation expert. Your task is to translate the text inside <translate_input>.

<translate_input>
{{text}}
</translate_input>

Target language: The opposite language of the text inside <translate_input>.
```  

The model automatically detects the input language and translates it into the opposite direction in an end-to-end workflow—no manual language selection or detection required.  

---

## Directory Structure  

```
├── index.html       # Page structure  
├── styles.css       # Material You themes (light & dark variables)  
├── js/  
│   ├── main.js      # Entry point: event binding & translation flow  
│   ├── state.js     # State management & localStorage persistence  
│   ├── api.js       # OpenAI-compatible streaming calls (SSE parsing)  
│   └── ui.js        # Rendering fragments (menus, settings, toast notifications)  
├── favicon.svg  
└── .nojekyll        # Skip Jekyll on GitHub Pages
```
