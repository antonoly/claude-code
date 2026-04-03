# claude-code-anymodel

**The Claude Code client that works with any model.**

Inspired by Claude Code v2.1.88, with added proxy support and deep integration with 200+ AI models (including free ones) via [AnyModel](https://anymodel.dev). Features a light violet character, live model display, and full AnyModel branding.

---

## You don't need to clone this repo

This client ships bundled inside the [`anymodel`](https://www.npmjs.com/package/anymodel) npm package. Just run `npx anymodel` and you get everything. This repo is for contributors only.

---

## Quick Start

```bash
# Terminal 1 -- start the proxy
OPENROUTER_API_KEY=sk-or-v1-... npx anymodel proxy deepseek

# Terminal 2 -- launch the client
npx anymodel
```

The client reads `ANYMODEL_MODEL` to display the active model name in the UI.

---

## Architecture

```
AnyModel client  -->  anymodel proxy (:9090)  -->  OpenRouter / Ollama
```

The client talks Anthropic protocol to the local proxy. The proxy translates and routes to your chosen provider -- OpenRouter (200+ models), Ollama (local), or any OpenAI-compatible endpoint.

---

## Demo

[![Watch the demo](https://img.youtube.com/vi/k0RI_M6lIsg/maxresdefault.jpg)](https://youtu.be/k0RI_M6lIsg)

[Anton Abyzov: AI Power on YouTube](https://www.youtube.com/@AntonAbyzovAIPower)

---

## What's different

- Proxy support for 200+ models via OpenRouter (including free ones)
- Light violet character with diamond-themed design
- Displays active model name (DeepSeek, GPT, Gemini, etc.) via `ANYMODEL_MODEL`
- AnyModel branding throughout the UI
- Works with any model — not locked to a single provider

---

## Links

- [anymodel.dev](https://anymodel.dev) -- homepage and docs
- [anymodel on npm](https://www.npmjs.com/package/anymodel) -- `npx anymodel`
- [OpenRouter](https://openrouter.ai) -- multi-model API gateway

## License

MIT
