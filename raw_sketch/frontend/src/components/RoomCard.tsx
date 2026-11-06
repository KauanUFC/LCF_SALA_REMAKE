import type { Device, Room } from '../types/types'

interface Props {
  room: Room
  onToggle: () => void
  onDelete: () => void
  onClick: () => void
  mqttConnected: boolean
}

export default function RoomCard({ room, onToggle, onDelete, onClick, mqttConnected }: Props) {
  const aggr = room.aggregate
  const statusClass = aggr.allOn ? 'all-on' : aggr.allOff ? 'all-off' : aggr.mixed ? 'mixed' : ''

  // WiFi and "Dev MQTT" come from fresh telemetry only (within 20s). Cached
  // lastTelemetry can be stale (device offline, retained MQTT message).
  // "Broker" reflects the backend's own MQTT connection to the broker.
  const devices = room.devices || []
  const FRESH_MS = 20000
  const isFresh = (d: Device) => d.lastTelemetryTs > 0 && Date.now() - d.lastTelemetryTs <= FRESH_MS
  const anyFresh = devices.some(isFresh)

  const wifiOk = devices.filter((d) => isFresh(d) && d.lastTelemetry?.wifi_connected === true).length
  const wifiSome = devices.some((d) => isFresh(d) && d.lastTelemetry?.wifi_connected === true)
  const wifiAll = wifiOk === devices.length && devices.length > 0
  const wifiColor = anyFresh ? (wifiAll ? 'green' : wifiSome ? 'yellow' : 'red') : 'muted'
  const wifiLabel = wifiAll ? 'OK' : wifiSome ? 'Mixed' : '—'

  const mqttOk = devices.filter((d) => isFresh(d) && d.lastTelemetry?.mqtt_connected === true).length
  const mqttSome = devices.some((d) => isFresh(d) && d.lastTelemetry?.mqtt_connected === true)
  const mqttAll = mqttOk === devices.length && devices.length > 0
  const mqttColor = anyFresh ? (mqttAll ? 'green' : mqttSome ? 'yellow' : 'red') : 'muted'
  const mqttLabel = mqttAll ? 'Connected' : mqttSome ? 'Mixed' : '—'

  return (
    <div className={`room-card ${statusClass}`} onClick={onClick}>
      <div className="room-card-header">
        <span className="room-icon">{room.icon}</span>
        <div className="room-info">
          <div className="room-name">{room.name}</div>
          <div className="room-meta">{aggr.total} device{aggr.total !== 1 ? 's' : ''} · {aggr.online} online</div>
        </div>
        <span className={`badge ${aggr.allOn ? 'badge-online' : aggr.allOff ? 'badge-offline' : 'badge-awaiting'}`}>
          {aggr.allOn ? 'All On' : aggr.allOff ? 'All Off' : aggr.mixed ? 'Mixed' : '—'}
        </span>
      </div>

      <div className="room-card-body">
        <div className="room-stats">
          <div className="stat"><span className="value green">{aggr.online}</span><span className="label">Online</span></div>
          <div className="stat"><span className="value red">{aggr.offline}</span><span className="label">Offline</span></div>
          <div className="stat"><span className="value yellow">{aggr.busy}</span><span className="label">Busy</span></div>
        </div>
        <div className="room-connection-status">
          <span className="status-item"><span className={`dot ${mqttConnected ? 'green' : 'red'}`} />Broker {mqttConnected ? 'Connected' : 'Offline'}</span>
          <span className="status-item"><span className={`dot ${wifiColor}`} />WiFi {wifiLabel}</span>
          <span className="status-item"><span className={`dot ${mqttColor}`} />Dev MQTT {mqttLabel}</span>
        </div>
      </div>

      <div className="room-card-footer" onClick={(e) => e.stopPropagation()}>
        <label className="toggle-switch">
          <input type="checkbox" checked={aggr.allOn} onChange={onToggle} />
          <span className={`toggle-track ${aggr.allOn ? 'on' : ''}`}><span className="toggle-thumb" /></span>
          <span className="toggle-label" style={{
            color: aggr.allOn ? 'var(--success)' : aggr.allOff ? 'var(--danger)' : 'var(--warning)',
            fontWeight: 600,
          }}>
            {aggr.allOn ? 'All On' : aggr.allOff ? 'All Off' : 'Few'}
          </span>
        </label>
        <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); onDelete() }}>✕</button>
      </div>
    </div>
  )
}