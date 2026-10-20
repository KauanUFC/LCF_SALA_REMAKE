'use strict';
// Self-contained smoke test for the LCFLIGHT backend.
const { spawn } = require('child_process');
const path = require('path');

const backend = require('path').join(__dirname, '..');
const url = 'http://127.0.0.1:3200';
const logs = [];

function line(s) { console.log(s); }

const server = spawn('node', ['src/server.js'], {
  cwd: backend,
  env: {
    ...process.env,
    DB_PATH: path.join(backend, 'data/smoke.db'),
    PORT: '3200',
    MQTT_BROKER_URL: 'mqtt://127.0.0.1:1',
    FRONTEND_DIR: path.join(backend, '../frontend/dist'),
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

server.stdout.on('data', (d) => logs.push(d.toString().trim()));
server.stderr.on('data', (d) => logs.push(d.toString().trim()));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;

async function get(p, init) {
  const res = await fetch(url + p, init);
  return { status: res.status, body: await res.json().catch(() => null) };
}

function check(name, cond, extra = '') {
  if (cond) line(`  PASS: ${name}`);
  else { failures++; line(`  FAIL: ${name} ${extra}`); }
}

async function main() {
  await sleep(1500);

  // Wait until the server actually accepts connections (up to 5s).
  let up = false;
  for (let i = 0; i < 10; i++) {
    try {
      const r = await fetch(url + '/api/info');
      if (r.ok) { up = true; break; }
    } catch { /* retry */ }
    await sleep(500);
  }
  if (!up) {
    line('SMOKE TEST: server did not come up. Logs:');
    line(logs.slice(0, 15).join('\n'));
    server.kill('SIGKILL');
    process.exit(1);
  }

  line('\n--- GET /api/info ---');
  const info = await get('/api/info');
  check('info status 200', info.status === 200);
  check('info has version', info.body?.version === '2.0.0');

  line('--- GET / (frontend) ---');
  const home = await fetch(url + '/');
  check('frontend 200 html', home.status === 200 && (home.headers.get('content-type') || '').includes('text/html'));

  line('--- POST /api/devices ---');
  const created = await get('/api/devices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Kitchen', description: 'demo', ip: '127.0.0.1' }),
  });
  check('created 201', created.status === 201);
  check('created has id', created.body?.id?.startsWith('dev_'));
  check('created default commands', Array.isArray(created.body?.commands) && created.body.commands.length === 1);
  check('created command is led', created.body?.commands?.[0]?.id === 'led');
  const id = created.body.id;

  line('--- GET /api/devices ---');
  const list = await get('/api/devices');
  check('list contains device', list.body?.some((d) => d.id === id));

  line('--- PATCH /api/devices/:id (mqtt mode) ---');
  const patched = await get(`/api/devices/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commandMode: 'mqtt' }),
  });
  check('patch 200 + mqtt mode', patched.status === 200 && patched.body?.commandMode === 'mqtt');

  line('--- PATCH invalid mode ---');
  const badPatch = await get(`/api/devices/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commandMode: 'bogus' }),
  });
  check('invalid mode 400', badPatch.status === 400);

  line('--- POST command (missing payload) ---');
  const noCmd = await get(`/api/devices/${id}/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  check('missing payload 400', noCmd.status === 400);

  line('--- SSE stream ---');
  const sse = await fetch(url + '/events');
  const reader = sse.body.getReader();
  const { value } = await reader.read();
  const chunk = new TextDecoder().decode(value);
  const hasReplay = chunk.includes('device_update') && chunk.includes('type');
  check('SSE replays device status', hasReplay);
  reader.cancel();
  sse.body.cancel().catch(() => {});

  line('--- DELETE /api/devices/:id ---');
  const del = await get(`/api/devices/${id}`, { method: 'DELETE' });
  check('delete 200', del.status === 200);
  const after = await get(`/api/devices/${id}`);
  check('device gone (404)', after.status === 404);

  line('\n========================================');
  if (failures === 0) { line('ALL CHECKS PASSED'); } else { line(`${failures} CHECK(S) FAILED`); }
  server.kill('SIGTERM');
  setTimeout(() => process.exit(failures === 0 ? 0 : 1), 500);
}

main().catch((e) => { line('SMOKE TEST ERROR: ' + e.message); server.kill('SIGKILL'); process.exit(1); });