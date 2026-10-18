const express = require("express");
const mqtt = require("mqtt");
const multer = require("multer");
const crypto = require("crypto");

const app = express();
const PORT = 3000;
const ESP32_OTA_PORT = 8266;
const ESP32_OTA_USER = process.env.ESP32_OTA_USER || "admin";
const ESP32_OTA_PASS = process.env.ESP32_OTA_PASS || "123";
const MQTT_BROKER = process.env.MQTT_BROKER || "mqtt://broker.hivemq.com:1883";
// const MQTT_BROKER = process.env.MQTT_BROKER || "mqtt://<ip>:1883"; // broker local Mosquitto

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024 } });

// --- Device registry ---
let devices = {};
let sseClients = [];
let mqttConnected = false;

// --- MQTT ---
const mqttClient = mqtt.connect(MQTT_BROKER);

mqttClient.on("connect", () => {
  mqttConnected = true;
  console.log("MQTT connected to broker");
  mqttClient.subscribe("esp32/+/telemetry");
  mqttClient.subscribe("esp32/+/status");
});

mqttClient.on("error", (err) => {
  console.error("MQTT error:", err.message);
});

mqttClient.on("offline", () => {
  mqttConnected = false;
  console.log("MQTT offline");
});

mqttClient.on("reconnect", () => {
  console.log("MQTT reconnecting...");
});

mqttClient.on("message", (topic, message) => {
  let payload;
  try {
    payload = JSON.parse(message.toString());
  } catch {
    return;
  }
  const topicMac = (topic.split("/")[1] || "").toLowerCase();
  if (!topicMac) return;

  const device = Object.values(devices).find(d => d.mac && d.mac.toLowerCase() === topicMac);
  if (!device) return;

  device.lastTelemetry = payload;
  device.lastTelemetryTs = Date.now();
  broadcast({ type: "telemetry", deviceId: device.id, data: payload });
});

/*
//old version of mqtt message handler with try/catch for JSON parsing

mqttClient.on("message", (topic, message) => {
  try {
    const payload = JSON.parse(message.toString());
    const topicMac = (topic.split("/")[1] || "").toLowerCase();
    if (!topicMac) return;

    const device = Object.values(devices).find(d => d.mac && d.mac.toLowerCase() === topicMac);
    if (!device) return;

    device.lastTelemetry = payload;
    device.lastTelemetryTs = Date.now();
    broadcast({ type: "telemetry", deviceId: device.id, data: payload });
  } catch (e) {
    console.error("MQTT parse error:", e.message);
  }
});
*/

// --- Helpers ---

function broadcast(event) {
  const msg = `event: device_update\ndata: ${JSON.stringify(event)}\n\n`;
  sseClients.forEach(res => {
    try { res.write(msg); } catch {}
  });
}

function isValidIp(ip) {
  return ip && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip);
}

async function probeDevice(ip) {
  const res = await fetch(`http://${ip}/api/device`, { signal: AbortSignal.timeout(3000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data;
}

async function probeCapabilities(ip) {
  try {
    const res = await fetch(`http://${ip}/api/capabilities`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return [];
    const data = await res.json();
    return data.commands || [];
  } catch {
    return [];
  }
}

// --- Middleware ---
app.use(express.static("public"));
app.use(express.json());

// --- Device CRUD ---

app.get("/api/config", (req, res) => {
  res.json({ mqtt_connected: mqttConnected });
});

app.post("/api/devices", async (req, res) => {
  const { name, description, ip } = req.body;
  if (!name || !ip) {
    return res.status(400).json({ error: "name and ip are required" });
  }
  if (!isValidIp(ip) && !ip.includes(".local")) {
    return res.status(400).json({ error: "Invalid IP address" });
  }

  const id = "dev_" + crypto.randomBytes(4).toString("hex");
  const device = { id, name, description: description || "", ip, mac: null, deviceId: null, status: "connecting", error: null, lastTelemetry: null, lastTelemetryTs: 0, commands: [{ id: "led", label: "LED", type: "binary", actions: ["on", "off"] }], commandMode: "http" };
  devices[id] = device;
  res.status(201).json(device);
  broadcast({ type: "status", deviceId: id, data: { status: "connecting", name, description: description || "", ip, commands: device.commands, commandMode: device.commandMode } });

  probeDevice(ip).then(async (info) => {
    device.mac = info.mac;
    device.deviceId = info.device_id;
    const caps = await probeCapabilities(ip);
    if (caps.length > 0) device.commands = caps;
    device.status = "connected";
    broadcast({ type: "status", deviceId: id, data: { status: "connected", name, description: description || "", ip, mac: info.mac, deviceId: info.device_id, commands: device.commands, commandMode: device.commandMode } });
    console.log(`Device connected: ${name} @ ${ip} (${info.mac})`);
  }).catch((err) => {
    device.status = "error";
    device.error = err.message || "Connection failed";
    broadcast({ type: "status", deviceId: id, data: { status: "error", error: device.error } });
    console.log(`Device failed: ${name} @ ${ip} — ${device.error}`);
  });
});

app.get("/api/devices", (req, res) => {
  res.json(Object.values(devices));
});

app.get("/api/devices/:id", (req, res) => {
  const device = devices[req.params.id];
  if (!device) return res.status(404).json({ error: "Device not found" });
  res.json(device);
});

app.patch("/api/devices/:id", (req, res) => {
  const device = devices[req.params.id];
  if (!device) return res.status(404).json({ error: "Device not found" });
  const { commandMode } = req.body;
  if (commandMode && (commandMode === "http" || commandMode === "mqtt")) {
    device.commandMode = commandMode;
  }
  res.json(device);
});

app.delete("/api/devices/:id", (req, res) => {
  const device = devices[req.params.id];
  if (!device) return res.status(404).json({ error: "Device not found" });
  delete devices[req.params.id];
  res.json({ success: true });
  broadcast({ type: "remove", deviceId: req.params.id });
});

// --- Command routing ---

app.post("/api/devices/:id/command", async (req, res) => {
  const device = devices[req.params.id];
  if (!device) return res.status(404).json({ error: "Device not found" });
  const { commandId, action } = req.body;
  if (!commandId || !action) return res.status(400).json({ error: "commandId and action required" });

  try {
    if (device.commandMode === "mqtt") {
      if (!device.mac) throw new Error("MAC not yet discovered");
      const topic = `esp32/${device.mac}/cmd/${commandId}`;
      const payload = JSON.stringify({ [commandId]: action });
      mqttClient.publish(topic, payload);
      res.json({ commandId, action, mode: "mqtt", topic });
    } else {
      const response = await fetch(`http://${device.ip}/${commandId}/${action}`, { signal: AbortSignal.timeout(3000) });
      const data = await response.json();
      res.json({ commandId, action, mode: "http", response: data });
    }
  } catch (error) {
    res.status(502).json({ error: "Command failed", details: error.message });
  }
});

// --- OTA upload ---

app.post("/api/ota/upload", upload.single("firmware"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No firmware file provided" });
  }

  const ext = req.file.originalname.toLowerCase().slice(-4);
  if (ext !== ".bin") {
    return res.status(400).json({ error: "File must be a .bin firmware" });
  }

  const deviceId = req.query.deviceId;
  const device = deviceId ? devices[deviceId] : null;
  if (!device || !device.ip) {
    return res.status(400).json({ error: "No target device specified or device not connected" });
  }

  const otaUrl = `http://${device.ip}:${ESP32_OTA_PORT}/update`;
  const auth = Buffer.from(`${ESP32_OTA_USER}:${ESP32_OTA_PASS}`).toString("base64");
  const boundary = "----OTAFormBoundary" + Date.now();

  const bodyParts = [];
  bodyParts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="firmware"; filename="firmware.bin"\r\nContent-Type: application/octet-stream\r\n\r\n`
  ));
  bodyParts.push(req.file.buffer);
  bodyParts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
  const body = Buffer.concat(bodyParts);

  try {
    const response = await fetch(otaUrl, {
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": body.length.toString(),
        Authorization: `Basic ${auth}`,
      },
      body,
      signal: AbortSignal.timeout(60000),
    });

    const text = await response.text();
    const ok = response.ok;
    console.log(`OTA response for ${device.name} (${response.status}): ${text}`);
    res.json({ success: ok, status: response.status, message: text.trim() });
  } catch (error) {
    console.error("OTA upload error:", error.message);
    res.status(502).json({ error: "OTA upload failed", details: error.message });
  }
});

// --- SSE endpoint ---

app.get("/events", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  Object.values(devices).forEach(d => {
    res.write(`event: device_update\ndata: ${JSON.stringify({ type: "status", deviceId: d.id, data: { status: d.status, mac: d.mac, deviceId: d.deviceId, commands: d.commands, error: d.error, name: d.name, description: d.description, ip: d.ip, commandMode: d.commandMode } })}\n\n`);
    if (d.lastTelemetry) {
      res.write(`event: device_update\ndata: ${JSON.stringify({ type: "telemetry", deviceId: d.id, data: d.lastTelemetry })}\n\n`);
    }
  });

  sseClients.push(res);
  req.on("close", () => {
    sseClients = sseClients.filter(c => c !== res);
  });
});

// --- Start ---
app.listen(PORT, () => {
  console.log(`Web app running at http://localhost:${PORT}`);
});