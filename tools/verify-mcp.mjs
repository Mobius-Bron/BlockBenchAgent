// Verify the Blockbench MCP endpoint and list available tools.
// Usage: node tools/verify-mcp.mjs
const URL = process.argv[2] ?? 'http://localhost:3000/bb-mcp';
let sessionId = null;

async function rpc(body, headers = {}) {
  const res = await fetch(URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      ...(sessionId ? { 'mcp-session-id': sessionId } : {}),
      ...headers,
    },
    body: JSON.stringify(body),
  });
  const sid = res.headers.get('mcp-session-id');
  if (sid) sessionId = sid;
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

const init = await rpc({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'verify-mcp', version: '1.0.0' },
  },
});
console.log(
  'initialize:',
  init.status,
  JSON.stringify(init.json.result || init.json.error || init.json)
);

await rpc({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} });

const list = await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
if (list.json && list.json.result && list.json.result.tools) {
  const tools = list.json.result.tools;
  console.log(`tools/list: ${tools.length} tools`);
  console.log('all tool names:');
  for (const t of tools) console.log('  -', t.name);
} else {
  console.log('tools/list FAILED:', JSON.stringify(list.json).slice(0, 2000));
}
