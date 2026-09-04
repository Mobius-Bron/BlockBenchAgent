// Load the Blockbench MCP plugin into a running Blockbench via CDP.
// Idempotent: if the "mcp" plugin is already installed+loaded it does nothing.
// Usage:
//   node tools/load-mcp-plugin.mjs [debugPort] [pluginJsPath]
import { existsSync } from 'node:fs';

const DEBUG_PORT = Number(process.argv[2] ?? 9223);
const PLUGIN_PATH =
  process.argv[3] ?? 'd:/BlockBenchAgent/blockbench-mcp-plugin/dist/mcp.js';

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getPageTarget() {
  for (let i = 0; i < 90; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
      const targets = await res.json();
      const page = targets.find(
        (t) => t.type === 'page' && t.webSocketDebuggerUrl
      );
      if (page) return page;
    } catch {}
    await sleep(1000);
  }
  throw new Error(
    'No debuggable page target found on port ' + DEBUG_PORT
  );
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => resolve(ws);
    ws.onerror = (e) => reject(new Error('WebSocket error: ' + e.message));
  });
}

function createCdp(ws) {
  let nextId = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    }
  };
  return (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
}

async function evaluate(send, expression) {
  const r = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  return r?.result?.value;
}

async function waitReady(send) {
  for (let i = 0; i < 60; i++) {
    const ready = await evaluate(
      send,
      `typeof Plugin !== 'undefined' && typeof Settings !== 'undefined' && typeof Blockbench !== 'undefined' && typeof Plugins !== 'undefined'`
    );
    if (ready === true) return true;
    await sleep(1000);
  }
  return false;
}

if (!existsSync(PLUGIN_PATH)) {
  console.error('Plugin file not found:', PLUGIN_PATH);
  process.exit(1);
}

const target = await getPageTarget();
const ws = await connect(target.webSocketDebuggerUrl);
const send = createCdp(ws);
await send('Runtime.enable');

console.log('Waiting for Blockbench renderer to be ready...');
if (!(await waitReady(send))) {
  console.error('Blockbench renderer did not become ready.');
  process.exit(1);
}

// Check whether the plugin is already present / installed.
const status = await evaluate(
  send,
  `(() => {
    const p = window.Plugins && window.Plugins.registered && window.Plugins.registered.mcp;
    return p ? { present: true, installed: !!p.installed, disabled: !!p.disabled, title: p.title, version: p.version } : { present: false };
  })()`
);
console.log('Current plugin state:', JSON.stringify(status));

let result;
if (status && status.present && status.installed && !status.disabled) {
  result = { skipped: true, ...status };
  console.log('MCP plugin already loaded. Nothing to do.');
} else {
  const installExpr = `
(async () => {
  try {
    if (window.Plugins.registered && window.Plugins.registered.mcp && window.Plugins.registered.mcp.installed) {
      await window.Plugins.registered.mcp.unload();
      window.Plugins.registered.mcp.disabled = false;
    }
    const p = new Plugin();
    await p.loadFromFile({ path: ${JSON.stringify(PLUGIN_PATH)}, name: ${JSON.stringify(
    PLUGIN_PATH
  )}, content: '' }, false);
    return JSON.stringify({ id: p.id, title: p.title, version: p.version, installed: p.installed, source: p.source, disabled: p.disabled, path: p.path });
  } catch (err) {
    return JSON.stringify({ error: String((err && err.stack) || err) });
  }
})()`;
  const raw = await evaluate(send, installExpr);
  try {
    result = JSON.parse(raw);
  } catch {
    result = { raw };
  }
  console.log('Load result:', JSON.stringify(result));
}

ws.close();
if (result && result.error) process.exit(1);
process.exit(0);
