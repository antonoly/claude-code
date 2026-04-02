// OpenRouter proxy for Claude Code
// Routes /v1/messages → OpenRouter (Anthropic-compatible API, Bearer auth)
// Routes everything else → api.anthropic.com (passthrough for auth/config)
//
// Usage:
//   node openrouter-proxy.mjs                          # reads key from .env
//   OPENROUTER_MODEL=google/gemini-2.5-pro node openrouter-proxy.mjs  # specific model
//
// Then in another terminal:
//   ANTHROPIC_BASE_URL=http://localhost:9090 node cli.js

import http from 'http';
import https from 'https';
import { readFileSync } from 'fs';

// Load .env file if present (no dependencies needed)
try {
  const envFile = readFileSync(new URL('.env', import.meta.url), 'utf8');
  for (const line of envFile.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq > 0) {
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
} catch {}

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL;
const PORT = process.env.PROXY_PORT || 9090;
const MAX_RETRIES = 3;

if (!OPENROUTER_API_KEY) {
  console.error('Error: OPENROUTER_API_KEY environment variable is required');
  console.error('Get your key at https://openrouter.ai/keys');
  process.exit(1);
}

// Strip Anthropic-specific fields that break non-Anthropic providers
function sanitizeBody(body) {
  delete body.betas;
  delete body.metadata;
  delete body.speed;
  delete body.output_config;
  delete body.context_management;
  delete body.thinking;

  // Strip cache_control from system blocks
  if (Array.isArray(body.system)) {
    body.system = body.system.map(block => {
      if (typeof block === 'object' && block.cache_control) {
        const { cache_control, ...rest } = block;
        return rest;
      }
      return block;
    });
  }

  // Strip cache_control from message content blocks
  if (Array.isArray(body.messages)) {
    for (const msg of body.messages) {
      if (Array.isArray(msg.content)) {
        msg.content = msg.content.map(block => {
          if (typeof block === 'object' && block.cache_control) {
            const { cache_control, ...rest } = block;
            return rest;
          }
          return block;
        });
      }
    }
  }

  // Strip Anthropic-only tool fields
  if (Array.isArray(body.tools)) {
    body.tools = body.tools.map(tool => {
      const { cache_control, defer_loading, eager_input_streaming, strict, ...rest } = tool;
      return rest;
    });
  }

  // Normalize tool_choice: OpenRouter expects object, Claude Code may send string
  if (typeof body.tool_choice === 'string') {
    body.tool_choice = { type: body.tool_choice };
  }

  return body;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function sendToOpenRouter(url, payload) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'openrouter.ai',
      port: 443,
      path: '/api' + url,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'anthropic-version': '2023-06-01',
        'content-length': Buffer.byteLength(payload),
        'http-referer': 'https://github.com/antonoly/claude-code',
        'x-title': 'Claude Code',
      },
    };

    const pr = https.request(opts, (upstream) => {
      resolve(upstream);
    });
    pr.on('error', reject);
    pr.write(payload);
    pr.end();
  });
}

async function handleMessages(req, res) {
  let chunks = [];
  req.on('data', c => chunks.push(c));

  await new Promise(r => req.on('end', r));
  const raw = Buffer.concat(chunks);

  let parsed;
  try {
    parsed = JSON.parse(raw.toString());
  } catch {
    res.writeHead(400, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: { type: 'invalid_request', message: 'Invalid JSON' } }));
    return;
  }

  const originalModel = parsed.model;
  if (OPENROUTER_MODEL) parsed.model = OPENROUTER_MODEL;

  sanitizeBody(parsed);

  const payload = JSON.stringify(parsed);
  const modelDisplay = OPENROUTER_MODEL ? `${originalModel} → ${OPENROUTER_MODEL}` : originalModel;
  console.log(`\x1b[36m[OPENROUTER]\x1b[0m ${req.method} ${req.url} model=${modelDisplay} stream=${parsed.stream}`);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const upstream = await sendToOpenRouter(req.url, payload, attempt);

      if (upstream.statusCode === 429 || upstream.statusCode >= 500) {
        // Drain the error body for logging
        const errChunks = [];
        upstream.on('data', c => errChunks.push(c));
        await new Promise(r => upstream.on('end', r));
        const errBody = Buffer.concat(errChunks).toString();

        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
        console.log(`\x1b[31m[OPENROUTER]\x1b[0m ${upstream.statusCode} on attempt ${attempt}/${MAX_RETRIES}, retrying in ${delay}ms`);
        console.log(`\x1b[31m[OPENROUTER]\x1b[0m ${errBody.slice(0, 200)}`);

        if (attempt === MAX_RETRIES) {
          res.writeHead(upstream.statusCode, upstream.headers);
          res.end(errBody);
          return;
        }
        await sleep(delay);
        continue;
      }

      // Success or client error — pipe through
      if (upstream.statusCode !== 200) {
        const errChunks = [];
        upstream.on('data', c => errChunks.push(c));
        await new Promise(r => upstream.on('end', r));
        const errBody = Buffer.concat(errChunks).toString();
        console.log(`\x1b[31m[OPENROUTER]\x1b[0m ${upstream.statusCode}: ${errBody.slice(0, 300)}`);
        res.writeHead(upstream.statusCode, upstream.headers);
        res.end(errBody);
        return;
      }

      // Stream successful response back to Claude Code
      console.log(`\x1b[32m[OPENROUTER]\x1b[0m 200 ← streaming response (attempt ${attempt})`);
      res.writeHead(200, upstream.headers);
      upstream.pipe(res);
      return;

    } catch (e) {
      console.error(`\x1b[31m[OPENROUTER]\x1b[0m Connection error on attempt ${attempt}: ${e.message}`);
      if (attempt === MAX_RETRIES) {
        res.writeHead(502, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: { type: 'proxy_error', message: e.message } }));
        return;
      }
      await sleep(1000 * attempt);
    }
  }
}

function proxyToAnthropic(req, res) {
  let body = [];
  req.on('data', c => body.push(c));
  req.on('end', () => {
    const opts = {
      hostname: 'api.anthropic.com',
      port: 443,
      path: req.url,
      method: req.method,
      headers: { ...req.headers, host: 'api.anthropic.com' },
    };
    const pr = https.request(opts, pr2 => {
      res.writeHead(pr2.statusCode, pr2.headers);
      pr2.pipe(res);
    });
    pr.on('error', e => { res.writeHead(502); res.end(e.message); });
    if (body.length) pr.write(Buffer.concat(body));
    pr.end();
  });
}

const server = http.createServer((req, res) => {
  if (req.url?.startsWith('/v1/messages')) {
    handleMessages(req, res);
  } else {
    console.log(`\x1b[33m[ANTHROPIC]\x1b[0m ${req.method} ${req.url}`);
    proxyToAnthropic(req, res);
  }
});

server.listen(PORT, () => {
  console.log(`\n\x1b[36m\u2194\x1b[0m  OpenRouter proxy on :${PORT}`);
  console.log(`   /v1/messages \u2192 OpenRouter (${OPENROUTER_MODEL || 'passthrough model'})`);
  console.log(`   everything else \u2192 api.anthropic.com`);
  console.log(`   Retries: ${MAX_RETRIES} with exponential backoff`);
  if (OPENROUTER_MODEL) {
    console.log(`   Model override: ${OPENROUTER_MODEL}`);
  }
  console.log(`\n   Run: ANTHROPIC_BASE_URL=http://localhost:${PORT} node cli.js\n`);
});
