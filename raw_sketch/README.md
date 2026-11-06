# LCFLIGHT — Backend & Frontend

Web dashboard para dispositivos ESP32 (telemetria + comandos + OTA).
Substitui o monólito `app.js`/`public/index.html` por uma stack modular:

- **Backend** (`backend/`): Express 5 + MQTT + SSE + SQLite (better-sqlite3)
- **Frontend** (`frontend/`): Vite + React 19 + TypeScript

## Estrutura

```
backend/
  src/
    config/env.js        # toda a configuração via variáveis de ambiente
    config/topics.js     # construção centralizada dos tópicos MQTT
    db/schema.sql        # schema SQLite (histórico de telemetria comentado/reservado)
    db/device-repo.js    # repositório de dispositivos
    mqtt/mqtt-service.js # cliente MQTT + dispatch para o device service
    services/            # device-service, command-service, ota-service, sse-service
    routes/              # info, broker, devices, commands, ota, events (SSE)
    server.js            # entrada
frontend/
  src/
    api/client.ts        # cliente HTTP tipado
    hooks/               # useDevices, useSse, useBrokerStatus
    components/          # Sidebar, Dashboard, DeviceCard, OTA, Settings
    styles/theme.css
```

## Início rápido (recomendado)

Na pasta `raw_sketch/`, rode o script que builda o frontend e inicia o backend:

```bash
cd raw_sketch
./run.sh
```

Depois abra no navegador: **http://localhost:3000**

O script:
1. cria `backend/.env` a partir de `.env.example` (se não existir),
2. instala dependências faltantes,
3. faz o build do frontend (`frontend/dist`),
4. inicia o backend, que serve a UI, a API e o SSE na mesma porta.

Para parar: `Ctrl+C`.

## Modo desenvolvimento (hot reload)

```bash
cd raw_sketch
./dev.sh
```

- Backend/API: `http://localhost:3000`
- Frontend (Vite): **http://localhost:5173** ← abra esta URL
- O dev server faz proxy de `/api` e `/events` para o backend.

## Uso em desenvolvimento (manual)

```bash
# 1) Backend (porta 3000)
cd backend
cp .env.example .env        # edite conforme necessário
npm install
npm run dev

# 2) Frontend (porta 5173, proxy /api e /events para o backend)
cd frontend
npm install
npm run dev
```

## Uso em produção (single server, sem Docker)

```bash
cd frontend && npm run build      # gera frontend/dist
cd ../backend && npm start        # serve dist/ + API + SSE em :3000
# Acesse http://localhost:3000
```

> O frontend **precisa** ser buildado antes do `npm start` — o backend serve `../frontend/dist`.

## Uso em produção (Docker)

```bash
cp backend/.env.example backend/.env   # configure broker, portas, credenciais
docker compose up -d --build
# Aplicação em http://localhost:3000, broker Mosquitto em :1883
```

## Verificações rápidas

```bash
curl http://localhost:3000/api/info       # backend está no ar?
curl http://localhost:3000/api/config     # broker MQTT conectado?
```

## Parar / reiniciar

```bash
# se iniciado em foreground (run.sh / npm start): Ctrl+C
pkill -f "src/server.js"                  # encerra qualquer instância
```


## Variáveis de ambiente (backend/.env)

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `PORT` | Porta HTTP | `3000` |
| `DB_PATH` | Arquivo SQLite | `./data/lcflight.db` |
| `MQTT_BROKER_URL` | URL do broker | `mqtt://broker.hivemq.com:1883` |
| `MQTT_USER` / `MQTT_PASS` | Credenciais MQTT (opcional) | vazio |
| `MQTT_PREFIX` | Prefixo dos tópicos | `esp32` |
| `OTA_PORT` / `OTA_USER` / `OTA_PASS` | Endpoint OTA do firmware | `8266`/`admin`/vazio |
| `PROBE_TIMEOUT_MS` / `COMMAND_TIMEOUT_MS` | Timeouts de rede | `3000` |
| `SSE_HEARTBEAT_MS` | Heartbeat do evento stream | `15000` |
| `TELEMETRY_RETENTION_PER_DEVICE` | Reservado p/ histórico | `200` |
| `FRONTEND_DIR` | Build do frontend servido | `../frontend/dist` |

## Tópicos MQTT

| Direção | Tópico | Conteúdo |
|---------|--------|----------|
| device → backend | `{prefix}/{mac}/telemetry` | JSON de telemetria |
| device → backend | `{prefix}/{mac}/status` | status retido no connect |
| backend → device | `{prefix}/{mac}/cmd/{command}` | comando `{"led":"on"}` |

## Novidades vs. versão anterior

- Nada hardcoded: tudo via `.env`.
- Persistência SQLite para o registro de dispositivos (sobrevive a reinício).
- Frontend React componentizado (sem HTML/JS inline).
- Histórico de telemetria: schema e repo **preparados mas comentados** em
  `backend/src/db/schema.sql` + `backend/src/db/device-repo.js` para ativação futura.