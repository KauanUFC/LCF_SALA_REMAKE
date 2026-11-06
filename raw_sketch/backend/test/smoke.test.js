'use strict';
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

  line('--- POST /api/rooms ---');
  const room = await get('/api/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test Room', icon: '🏠' }),
  });
  check('room created 201', room.status === 201);
  check('room has id', room.body?.id === 1);
  check('room name correct', room.body?.name === 'Test Room');
  const roomId = room.body.id;

  line('--- GET /api/rooms ---');
  const rooms = await get('/api/rooms');
  check('rooms list has 1', Array.isArray(rooms.body) && rooms.body.length === 1);
  check('room aggregate included', rooms.body[0].aggregate !== undefined);

  line('--- POST /api/devices (in room) ---');
  const dev = await get('/api/devices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Lamp', ip: '127.0.0.1', roomId }),
  });
  check('device created 201', dev.status === 201);
  check('device has int id', typeof dev.body?.id === 'number');
  check('device roomId correct', dev.body?.roomId === roomId);
  check('device type default relay', dev.body?.deviceType === 'relay');
  check('device has commands', Array.isArray(dev.body?.commands) && dev.body.commands.length === 1);
  const devId = dev.body.id;

  line('--- GET /api/rooms?search= ---');
  const searched = await get('/api/rooms?search=Test');
  check('search finds matching room', Array.isArray(searched.body) && searched.body.some((r) => r.name === 'Test Room'));
  const searchMiss = await get('/api/rooms?search=zzzNoMatch');
  check('search no-match returns empty', Array.isArray(searchMiss.body) && searchMiss.body.length === 0);

  line('--- POST /api/rooms (duplicate name -> 409) ---');
  const dup = await get('/api/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test Room', icon: '🏠' }),
  });
  check('duplicate name 409', dup.status === 409);

  line('--- PUT /api/rooms/:id (update name + icon) ---');
  const roomUpd = await get(`/api/rooms/${roomId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test Room', icon: '🛋' }),
  });
  check('room update 200', roomUpd.status === 200);
  check('room icon updated', roomUpd.body?.icon === '🛋');

  line('--- GET /api/rooms/:id (includes devices) ---');
  const detail = await get(`/api/rooms/${roomId}`);
  check('room detail 200', detail.status === 200);
  check('room has devices array', Array.isArray(detail.body?.devices));
  check('room aggregate total 1', detail.body?.aggregate?.total === 1);

  line('--- PUT /api/devices/:id ---');
  const renamed = await get(`/api/devices/${devId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Desk Lamp' }),
  });
  check('rename 200', renamed.status === 200);
  check('new name correct', renamed.body?.name === 'Desk Lamp');

  line('--- PATCH commandMode & POST command ---');
  const mode = await get(`/api/devices/${devId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commandMode: 'mqtt' }),
  });
  check('mode mqtt', mode.status === 200 && mode.body?.commandMode === 'mqtt');

  line('--- POST command (device not yet probed) ---');
  const cmd = await get(`/api/devices/${devId}/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commandId: 'led', action: 'on' }),
  });
  // Device hasn't completed probe, so this may error. Just ensure the route responds.
  check('command route responds', cmd.status !== 404);

  line('--- POST /api/devices with mac ---');
  const macDev = await get('/api/devices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'MacDev', ip: '127.0.0.1', roomId, mac: 'aabbccddeeff' }),
  });
  check('mac device created', macDev.status === 201);
  check('mac stored', macDev.body?.mac === 'aabbccddeeff');
  await get(`/api/devices/${macDev.body.id}`, { method: 'DELETE' });

  line('--- POST /api/devices/:id/restart ---');
  const restart = await get(`/api/devices/${devId}/restart`, { method: 'POST' });
  check('restart route responds', restart.status !== 404);

  line('--- POST command (missing payload) ---');
  const noCmd = await get(`/api/devices/${devId}/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  check('missing payload 400', noCmd.status === 400);

  line('--- SSE stream (replays device) ---');
  const sse = await fetch(url + '/events');
  const reader = sse.body.getReader();
  const { value } = await reader.read();
  const chunk = new TextDecoder().decode(value);
  const hasReplay = chunk.includes('device_update') && chunk.includes(`"deviceId":"${devId}"`);
  check('SSE replay contains device', hasReplay);
  reader.cancel();
  sse.body.cancel().catch(() => {});

  line('--- DELETE /api/devices/:id ---');
  const del = await get(`/api/devices/${devId}`, { method: 'DELETE' });
  check('delete 200', del.status === 200);
  const afterDel = await get(`/api/devices/${devId}`);
  check('device gone (404)', afterDel.status === 404);

  line('--- POST /api/schedules ---');
  const sched = await get('/api/schedules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Night off', roomId, action: 'power', triggerTime: '22:00', scope: 'room', state: 'off', repeatDays: '1,2,3,4,5' }),
  });
  check('schedule created 201', sched.status === 201);
  check('schedule id', sched.body?.id === 1);
  check('schedule name', sched.body?.name === 'Night off');
  check('schedule enabled', sched.body?.enabled === true);
  const schedId = sched.body.id;

  line('--- GET /api/schedules ---');
  const scheds = await get('/api/schedules');
  check('schedules list has 1', Array.isArray(scheds.body) && scheds.body.length === 1);

  line('--- POST /api/schedules (invalid time) ---');
  const badTime = await get('/api/schedules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Bad', action: 'power', triggerTime: '25:99', scope: 'room' }),
  });
  check('invalid time 400', badTime.status === 400);

  line('--- PUT /api/schedules/:id (brightness) ---');
  const upd = await get(`/api/schedules/${schedId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Bright morning', action: 'brightness', brightness: 50, triggerTime: '07:30' }),
  });
  check('update 200', upd.status === 200);
  check('updated name', upd.body?.name === 'Bright morning');
  check('updated action brightness', upd.body?.action === 'brightness');
  check('updated brightness 50', upd.body?.brightness === 50);

  line('--- POST /api/schedules/:id/toggle (disabling) ---');
  const off = await get(`/api/schedules/${schedId}/toggle`, { method: 'POST' });
  check('toggle disables', off.status === 200 && off.body?.enabled === false);
  const on = await get(`/api/schedules/${schedId}/toggle`, { method: 'POST' });
  check('toggle re-enables', on.status === 200 && on.body?.enabled === true);

  line('--- POST /api/schedules (devices scope, 2 devices) ---');
  // two fresh devices to link to the schedule
  const dA = await get('/api/devices', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name: 'DevA', ip: '127.0.0.1', roomId }) });
  const dB = await get('/api/devices', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name: 'DevB', ip: '127.0.0.1', roomId }) });
  check('devices for schedule created', dA.status === 201 && dB.status === 201);
  const schedDev = await get('/api/schedules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Sel devices', action: 'power', triggerTime: '08:00', scope: 'devices', state: 'on', deviceIds: [dA.body.id, dB.body.id] }),
  });
  check('devices-scope schedule created', schedDev.status === 201);
  check('schedule deviceIds stored', Array.isArray(schedDev.body?.deviceIds) && schedDev.body.deviceIds.length === 2);
  const schedDevId = schedDev.body.id;

  line('--- GET /api/schedules/:id (deviceIds round-trip) ---');
  const got = await get(`/api/schedules/${schedDevId}`);
  check('deviceIds returned on get', Array.isArray(got.body?.deviceIds) && got.body.deviceIds.length === 2 && got.body.deviceIds.includes(dA.body.id));

  line('--- PUT /api/schedules/:id (rename, deviceIds retained) ---');
  const schedUpd = await get(`/api/schedules/${schedDevId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Renamed', scope: 'devices', deviceIds: [dA.body.id, dB.body.id] }),
  });
  check('renamed ok', schedUpd.status === 200 && schedUpd.body.name === 'Renamed');
  check('deviceIds retained after update', Array.isArray(schedUpd.body?.deviceIds) && schedUpd.body.deviceIds.length === 2);

  line('--- PUT /api/schedules/:id (switch to room scope clears devices) ---');
  const roomSwitch = await get(`/api/schedules/${schedDevId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope: 'room', roomId }),
  });
  check('scope switched to room', roomSwitch.status === 200 && roomSwitch.body.scope === 'room');
  check('deviceIds cleared on room scope', Array.isArray(roomSwitch.body?.deviceIds) && roomSwitch.body.deviceIds.length === 0);

  const rmSchedDev = await get(`/api/schedules/${schedDevId}`, { method: 'DELETE' });
  check('devices-scope schedule deleted', rmSchedDev.status === 200);
  await get(`/api/devices/${dA.body.id}`, { method: 'DELETE' });
  await get(`/api/devices/${dB.body.id}`, { method: 'DELETE' });

  line('--- DELETE /api/schedules/:id ---');
  const rmSched = await get(`/api/schedules/${schedId}`, { method: 'DELETE' });
  check('schedule delete 200', rmSched.status === 200);
  const afterSched = await get(`/api/schedules/${schedId}`);
  check('schedule gone (404)', afterSched.status === 404);

  line('--- GET /api/preferences ---');
  const prefs = await get('/api/preferences');
  check('prefs 200', prefs.status === 200);
  check('prefs theme dark', prefs.body?.theme === 'dark');

  line('--- PUT /api/preferences ---');
  const prefsUpd = await get('/api/preferences', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ theme: 'light', notifyFailures: false }),
  });
  check('prefs update', prefsUpd.status === 200 && prefsUpd.body?.theme === 'light');
  check('prefs notifyFailures false', prefsUpd.body?.notifyFailures === false);

  line('--- GET /api/alerts ---');
  const alerts = await get('/api/alerts');
  check('alerts 200 + array', alerts.status === 200 && Array.isArray(alerts.body));

  line('--- POST /api/devices (fresh for config) ---');
  const cfgDev = await get('/api/devices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'CfgLamp', ip: '127.0.0.1', roomId }),
  });
  check('config device created', cfgDev.status === 201);

  line('--- GET /api/devices/' + cfgDev.body.id + '/config ---');
  const cfg = await get(`/api/devices/${cfgDev.body.id}/config`);
  check('config 200', cfg.status === 200);
  check('config supportsBrightness false (relay)', cfg.body?.supportsBrightness === false);

  line('--- PUT /api/devices/' + cfgDev.body.id + '/config ---');
  const cfgUpd = await get(`/api/devices/${cfgDev.body.id}/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ledCount: 4, supportsEffects: true }),
  });
  check('config update', cfgUpd.status === 200 && cfgUpd.body?.ledCount === 4);
  check('config supportsEffects true', cfgUpd.body?.supportsEffects === true);

  line('--- POST /api/scenes (from current) ---');
  const scene = await get('/api/scenes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Evening', roomId, fromCurrent: true }),
  });
  check('scene created 201', scene.status === 201);
  check('scene has id', scene.body?.id !== undefined);
  const sceneId = scene.body.id;

  line('--- GET /api/scenes ---');
  const scenes = await get('/api/scenes');
  check('scenes list has 1', Array.isArray(scenes.body) && scenes.body.length === 1);

  line('--- PUT /api/scenes/:id (rename) ---');
  const sceneUpd = await get(`/api/scenes/${sceneId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Movie Night' }),
  });
  check('scene rename', sceneUpd.status === 200 && sceneUpd.body?.name === 'Movie Night');

  line('--- POST /api/scenes/:id/apply ---');
  const sceneApply = await get(`/api/scenes/${sceneId}/apply`, { method: 'POST' });
  check('scene apply responds', sceneApply.status !== 404);

  line('--- DELETE /api/scenes/:id ---');
  const sceneDel = await get(`/api/scenes/${sceneId}`, { method: 'DELETE' });
  check('scene delete 200', sceneDel.status === 200);
  const sceneGone = await get(`/api/scenes/${sceneId}`);
  check('scene gone (404)', sceneGone.status === 404);

  line('--- DELETE /api/rooms/:id ---');
  const rm = await get(`/api/rooms/${roomId}`, { method: 'DELETE' });
  check('room delete 200', rm.status === 200);
  const afterRm = await get(`/api/rooms/${roomId}`);
  check('room gone (404)', afterRm.status === 404);

  line('\n========================================');
  if (failures === 0) { line('ALL CHECKS PASSED'); } else { line(`${failures} CHECK(S) FAILED`); }
  server.kill('SIGTERM');
  setTimeout(() => process.exit(failures === 0 ? 0 : 1), 500);
}

main().catch((e) => { line('SMOKE TEST ERROR: ' + e.message); server.kill('SIGKILL'); process.exit(1); });