# anymodel — AI Coding Assistant (any model)

A fork of Claude Code v2.1.88 by [Anton Abyzov](https://github.com/antonoly) that runs with **any AI model** — not just Anthropic. Uses [anymodel proxy](https://github.com/anton-abyzov/anymodel) to route through OpenRouter (200+ models), Ollama (local), or any compatible provider.

> **This is NOT Anthropic's `claude` command.** This is an independent fork (`node cli.js`) that works with any model via the anymodel proxy.

---

## Quick Start

**Terminal 1** — start the proxy:
```bash
npx anymodel
```

**Terminal 2** — run the app:
```bash
cd ~/Projects/claude-code-umb/repositories/antonoly/claude-code
ANTHROPIC_BASE_URL=http://localhost:9090 node cli.js
```

That's it. `npx anymodel` reads your `OPENROUTER_API_KEY` from `.env`, starts the proxy on `:9090`. `node cli.js` connects to it and runs with whatever model the proxy provides.

### With a specific free model

```bash
# Terminal 1:
npx anymodel --model qwen/qwen3-coder:free

# Terminal 2:
ANTHROPIC_BASE_URL=http://localhost:9090 node cli.js
```

### With the remote proxy (no local proxy needed)

```bash
ANTHROPIC_BASE_URL=https://anymodel-proxy.anton-abyzov.workers.dev \
ANTHROPIC_API_KEY=your-token \
node cli.js
```

---

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│  node cli.js    │ ──► │  anymodel :9090   │ ──► │  OpenRouter / Ollama │
│  (this repo)    │     │  (npx anymodel)   │     │  (200+ models)       │
│  fork of v2.1.88│     │  strips fields,   │     │  free & paid         │
│                 │     │  retries, routes   │     │                      │
└─────────────────┘     └──────────────────┘     └─────────────────────┘
```

- **`node cli.js`** — this repo, the UI/client (forked from Claude Code v2.1.88)
- **`npx anymodel`** — the proxy ([anymodel.dev](https://anymodel.dev)), strips Anthropic-specific fields, routes to any provider
- **OpenRouter** — 200+ models including free ones ($0)

### Key difference from `claude`

| | `claude` (Anthropic) | `node cli.js` (this repo) |
|---|---|---|
| Install | `npm i -g @anthropic-ai/claude-code` | `git clone` this repo |
| Models | Anthropic only | Any model via anymodel proxy |
| Version | Latest (v2.1.90+) | Forked from v2.1.88 |
| Auth | Anthropic account required | Works with OpenRouter key |

---

## Available Free Models

```bash
npx anymodel --model qwen/qwen3-coder:free               # Best for coding
npx anymodel --model nvidia/nemotron-3-super-120b-a12b:free  # NVIDIA reasoning
npx anymodel --model qwen/qwen3.6-plus:free               # 1M context
npx anymodel --model openai/gpt-oss-120b:free             # OpenAI open-source
npx anymodel --model nousresearch/hermes-3-llama-3.1-405b:free  # 405B
```

All $0 cost. See [anymodel.dev](https://anymodel.dev) for the full list.

---

## Legacy Proxy Files

The original standalone proxy files (before the `anymodel` npm package):

```bash
# OpenRouter (replaced by: npx anymodel)
OPENROUTER_API_KEY=sk-or-... node openrouter-proxy.mjs

# Ollama (replaced by: npx anymodel ollama)
node ollama-proxy.mjs

# BUDDY pet system
node buddy.mjs
```

---

## Links

- [anymodel.dev](https://anymodel.dev) — Proxy homepage and docs
- [anymodel on npm](https://www.npmjs.com/package/anymodel) — `npx anymodel`
- [anymodel on GitHub](https://github.com/anton-abyzov/anymodel) — Proxy source
- [Remote Proxy](https://anymodel-proxy.anton-abyzov.workers.dev/health) — Live Cloudflare Worker
- [OpenRouter](https://openrouter.ai) — Multi-model API gateway

## License

Proxy tools and modifications by [Anton Abyzov (antonoly)](https://github.com/antonoly) — MIT.
