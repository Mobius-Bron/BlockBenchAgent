// Minimal Blockbench MCP client for tool calls over streamable HTTP.
// Maintains a session id in .bbdata/.mcp-session.json.
//
// Usage:
//   node tools/bb-mcp.mjs init
//   node tools/bb-mcp.mjs tools
//   node tools/bb-mcp.mjs toolinfo <name>
//   node tools/bb-mcp.mjs call <toolName> '<jsonArgs>'
//   node tools/bb-mcp.mjs resources
//   node tools/bb-mcp.mjs prompts
//   node tools/bb-mcp.mjs reset
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const URL = process.env.BB_MCP_URL ?? 'http://localhost:3000/bb-mcp';
const SESSION_FILE = join(ROOT, '.bbdata', '.mcp-session.json');

let sessionId = null;
function loadSession() {
  if (existsSync(SESSION_FILE)) {
    try { sessionId = JSON.parse(readFileSync(SESSION_FILE, 'utf-8')).sessionId || null; } catch { sessionId = null; }
  }
}
loadSession();

async function rpc(body) {
  const res = await fetch(URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      ...(sessionId ? { 'mcp-session-id': sessionId } : {}),
    },
    body: JSON.stringify(body),
  });
  const sid = res.headers.get('mcp-session-id');
  if (sid) {
    sessionId = sid;
    writeFileSync(SESSION_FILE, JSON.stringify({ sessionId: sid }));
  }
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    const lines = text.split(/\r?\n/).filter((l) => l.startsWith('data:'));
    if (lines.length) {
      try { json = JSON.parse(lines.map((l) => l.slice(5)).join('\n')); }
      catch { json = { raw: text }; }
    } else {
      json = { raw: text };
    }
  }
  return { status: res.status, json };
}

async function doInit() {
  const { status, json } = await rpc({
    jsonrpc: '2.0', id: 1, method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'bb-mcp-cli', version: '1.0.0' },
    },
  });
  if (status !== 200 || json.error) {
    throw new Error('initialize failed: ' + JSON.stringify(json));
  }
  await rpc({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} });
  return json.result;
}

let idCounter = 100;
async function request(method, params = {}, parseTextContent = false) {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (!sessionId) await doInit();
    const id = ++idCounter;
    const { json } = await rpc({ jsonrpc: '2.0', id, method, params });
    if (!json || json.error) {
      const msg = (json && json.error && json.error.message) || '';
      const code = json && json.error && json.error.code;
      if (/already initialized/i.test(msg) && sessionId) {
        // Session is already initialized - just retry the request.
        continue;
      }
      if (
        /not initialized/i.test(msg) ||
        code === -32002 ||
        code === -32001 ||
        /Session not found/i.test(msg)
      ) {
        sessionId = null;
        writeFileSync(SESSION_FILE, JSON.stringify({ sessionId: null }));
        continue; // force fresh session
      }
      return { ok: false, error: json?.error ?? json };
    }
    return { ok: true, result: json.result };
  }
  return { ok: false, error: 'gave up after retries' };
}

const [, , cmd, a, b] = process.argv;

switch (cmd) {
  case 'init': {
    const info = await doInit();
    console.log(JSON.stringify(info.serverInfo ?? info, null, 2));
    console.log('sessionId:', sessionId);
    break;
  }
  case 'tools': {
    const { ok, result, error } = await request('tools/list');
    if (!ok) { console.error(JSON.stringify(error)); break; }
    if (result.tools) {
      for (const t of result.tools) {
        const ann = t.annotations;
        const title = ann?.title ? ` [${ann.title}]` : '';
        const desc = (t.description || '').split('\n')[0];
        console.log(`${t.name}${title} — ${desc}`);
      }
      console.log(`\nTotal: ${result.tools.length}`);
    } else {
      console.log(JSON.stringify(result));
    }
    break;
  }
  case 'toolinfo': {
    const name = a;
    const { ok, result, error } = await request('tools/list');
    if (!ok) { console.error(JSON.stringify(error)); break; }
    const t = result.tools?.find((x) => x.name === name);
    if (!t) { console.log('tool not found: ' + name); break; }
    console.log(JSON.stringify(t, null, 2));
    break;
  }
  case 'call': {
    const name = a;
    let args = {};
    if (b) {
      try {
        args = JSON.parse(b);
      } catch {
        if (b === '-') {
          const stdin = readFileSync(0, 'utf-8').replace(/^\uFEFF/, '');
          args = JSON.parse(stdin);
        } else if (b.startsWith('@') && existsSync(b.slice(1))) {
          args = JSON.parse(readFileSync(b.slice(1), 'utf-8').replace(/^\uFEFF/, ''));
        } else {
          console.error('bad args JSON:', b);
          process.exit(1);
        }
      }
    }
    const { ok, result, error } = await request('tools/call', { name, arguments: args });
    if (!ok) { console.error('TOOL ERROR:', JSON.stringify(error, null, 2)); process.exit(1); }
    if (result.isError) console.error('isError: true');
    for (const c of result.content ?? []) {
      if (c.type === 'text') console.log(c.text);
      else if (c.type === 'image') {
        const dir = join(ROOT, '.bbdata', 'shots');
        const fs = await import('node:fs');
        fs.mkdirSync(dir, { recursive: true });
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const fname = join(dir, `${name}-${ts}.png`);
        let b64 = c.data || '';
        if (b64.startsWith('data:')) b64 = b64.slice(b64.indexOf(',') + 1);
        fs.writeFileSync(fname, Buffer.from(b64, 'base64'));
        console.log(`[image saved to ${fname}]`);
      } else console.log(JSON.stringify(c));
    }
    if (result.structuredContent) {
      console.log('structured:', JSON.stringify(result.structuredContent, null, 2));
    }
    break;
  }
  case 'batch': {
    // args: plan JSON file path -> { calls: [{ tool, args }] }
    const planPath = a;
    const plan = JSON.parse(readFileSync(planPath, 'utf-8').replace(/^\uFEFF/, ''));
    for (const c of plan.calls || []) {
      const { ok, result, error } = await request('tools/call', {
        name: c.tool,
        arguments: c.args || {},
      });
      if (!ok) {
        console.log(`FAIL ${c.tool}: ${JSON.stringify(error)}`);
        process.exit(1);
      }
      const first = (result.content || [])
        .filter((x) => x.type === 'text')
        .map((x) => x.text.split('\n')[0])
        .join(' | ');
      console.log(`${c.tool} -> ${first || '(no text)'}`);
    }
    console.log('batch done');
    break;
  }
  case 'resources': {
    const { ok, result, error } = await request('resources/list');
    console.log(JSON.stringify(ok ? result : error, null, 2));
    break;
  }
  case 'prompts': {
    const { ok, result, error } = await request('prompts/list');
    console.log(JSON.stringify(ok ? result : error, null, 2));
    break;
  }
  case 'reset': {
    writeFileSync(SESSION_FILE, JSON.stringify({ sessionId: null }));
    console.log('session reset');
    break;
  }
  default:
    console.log('usage: see header comment');
}
