import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useBrokerStatus } from '../hooks/useBrokerStatus'
import type { useDevices as UseDevices } from '../hooks/useDevices'
import type { DeviceConfig } from '../types/types'
import { fmtBytes, fmtUptime, timeAgo } from '../lib/format'

type DevicesHook = ReturnType<typeof UseDevices>

interface Props {
  hook: DevicesHook
}

function rssiClass(rssi: number | undefined): string {
  if (rssi == null) return ''
  if (rssi > -60) return 'green'
  if (rssi > -80) return 'yellow'
  return 'red'
}

export default function DeviceDetail({ hook }: Props) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { mqttConnected } = useBrokerStatus()
  const deviceId = Number(id)
  const device = hook.devices.find((d) => d.id === deviceId)
  const [busy, setBusy] = useState(false)
  const [cmdMsg, setCmdMsg] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editRoom, setEditRoom] = useState<number | ''>('')
  const [editType, setEditType] = useState('relay')
  const [rooms, setRooms] = useState<{ id: number; name: string; icon: string }[]>([])
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [config, setConfig] = useState<DeviceConfig | null>(null)

  useEffect(() => {
    api.listRooms().then((r) => setRooms(r.map((x) => ({ id: x.id, name: x.name, icon: x.icon })))).catch(() => setRooms([]))
    if (deviceId) {
      api.getDeviceConfig(deviceId).then(setConfig).catch(() => setConfig(null))
    }
  }, [deviceId])

  if (!device) {
    return <div className="section"><p>Device not found. <Link to="/devices">Back to devices</Link></p></div>
  }

  const tel = device.lastTelemetry || {}
  const isOn = tel.led_state === 'on'
  const isDimmable = ['dimmable', 'rgb', 'strip'].includes(device.deviceType)
  const teleFresh = !!device.lastTelemetry && !hook.isStale(device)
  const wifiOk = teleFresh && tel.wifi_connected === true
  const mqttOkTel = teleFresh && tel.mqtt_connected === true

  const sendCmd = async (action: string, value?: string | number) => {
    if (busy) return
    setBusy(true); setCmdMsg('Sending...')
    try {
      await hook.sendCommand(device.id, 'led', action, value)
      setCmdMsg(`${action}${value !== undefined ? ` ${value}` : ''} sent`)
    } catch (e) {
      setCmdMsg(`Error: ${(e as Error).message}`)
    } finally {
      setBusy(false); setTimeout(() => setCmdMsg(null), 3000)
    }
  }

  const doRestart = async () => {
    if (busy) return
    if (!confirm(`Restart ${device.name}? The device will reboot and may take ~30s to reconnect.`)) return
    setBusy(true); setCmdMsg('Restarting...')
    try {
      await api.restartDevice(device.id)
      setCmdMsg('Restart command sent — device will reboot.')
    } catch (e) {
      setCmdMsg(`Restart failed: ${(e as Error).message}`)
    } finally {
      setTimeout(() => { setBusy(false); setCmdMsg(null) }, 5000)
    }
  }

  const saveEdit = async () => {
    if (!editName.trim()) return
    await api.updateDevice(device.id, {
      name: editName.trim(),
      roomId: editRoom === '' ? undefined : Number(editRoom),
      deviceType: editType,
    })
    await hook.refresh()
    setEditing(false)
  }

  const removeDevice = async () => {
    if (!confirm(`Remove ${device.name}? This cannot be undone.`)) return
    await hook.removeDevice(device.id)
    navigate('/devices')
  }

  const startEdit = () => {
    setEditName(device.name)
    setEditRoom(device.roomId ?? '')
    setEditType(device.deviceType)
    setEditing(true)
  }

  return (
    <div className="section">
      <div className="page-header">
        <h2>{device.name}</h2>
        <div className="row-actions">
          <button className="btn btn-sm btn-ghost" onClick={startEdit}>Edit</button>
          <Link to="/devices" className="btn btn-sm btn-ghost">← Back</Link>
        </div>
      </div>

      {/* RAW_TESTE-style status bar */}
      <div className="status-bar">
        <span className="status-item"><span className={`dot ${mqttConnected ? 'green' : 'red'}`} />Broker</span>
        <span className="status-item"><span className={`dot ${hook.isOnline(device) ? 'green' : 'red'}`} />{device.ip || 'no ip'}</span>
        <span className="status-item"><span className="dot muted" />MAC: {device.mac || '—'}</span>
        <span className="status-item"><span className={`dot ${wifiOk ? 'green' : 'red'}`} />WiFi {teleFresh ? (wifiOk ? 'OK' : 'Offline') : '—'}</span>
        <span className="status-item"><span className={`dot ${mqttOkTel ? 'green' : 'red'}`} />Dev MQTT {teleFresh ? (mqttOkTel ? 'Connected' : 'Disconnected') : '—'}</span>
      </div>

      {/* RAW_TESTE-style 8 metric cards */}
      {device.lastTelemetry ? (
        <div className={`metric-grid ${!teleFresh ? 'metric-stale' : ''}`}>
          <div className="metric-card"><span className="label">Device</span><span className="value blue">{tel.device_id || '---'}</span></div>
          <div className="metric-card"><span className="label">LED State</span><span className={`value ${isOn ? 'green' : 'red'}`}>{isOn ? 'ON' : 'OFF'}</span></div>
          <div className="metric-card"><span className="label">RSSI</span><span className={`value ${rssiClass(tel.rssi as number | undefined)}`}>{tel.rssi != null ? `${tel.rssi} dBm` : '---'}</span></div>
          <div className="metric-card"><span className="label">Free Heap</span><span className="value">{fmtBytes(tel.free_heap as number)}</span></div>
          <div className="metric-card"><span className="label">Uptime</span><span className="value">{fmtUptime(tel.uptime_s as number)}</span></div>
          <div className="metric-card"><span className="label">Temp (CPU)</span><span className="value">{(tel.temp_cpu as number) != null ? `${(tel.temp_cpu as number).toFixed(1)} °C` : '---'}</span></div>
          <div className="metric-card"><span className="label">Dev MQTT</span><span className={`value ${mqttOkTel ? 'green' : 'red'}`}>{mqttOkTel ? 'Connected' : 'Disconnected'}</span></div>
          <div className="metric-card"><span className="label">WiFi</span><span className={`value ${wifiOk ? 'green' : 'red'}`}>{wifiOk ? 'Connected' : 'Disconnected'}</span></div>
        </div>
      ) : (
        <div className="waiting">Waiting for telemetry data... {device.status === 'error' ? `(last error: ${device.error})` : ''}</div>
      )}

      {/* Controls */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-header">
          <h3>Controls</h3>
          <div className="mode-group" style={{ gap: '0.5rem' }}>
            <label style={{ fontSize: '0.8125rem', cursor: 'pointer' }}>
              <input type="radio" checked={device.commandMode === 'http'} onChange={() => hook.setMode(device.id, 'http')} /> HTTP
            </label>
            <label style={{ fontSize: '0.8125rem', cursor: 'pointer' }}>
              <input type="radio" checked={device.commandMode === 'mqtt'} onChange={() => hook.setMode(device.id, 'mqtt')} /> MQTT
            </label>
          </div>
        </div>
        <div className="card-body">
          <div className="device-controls">
            <label className="toggle-switch" style={{ margin: '0 auto' }}>
              <input type="checkbox" checked={isOn} onChange={() => sendCmd(isOn ? 'off' : 'on')} disabled={busy} />
              <span className={`toggle-track ${isOn ? 'on' : ''}`}><span className="toggle-thumb" /></span>
              <span className="toggle-label">{isOn ? 'On' : 'Off'}</span>
            </label>
            <button className="btn btn-ghost" onClick={doRestart} disabled={busy}>
              ⏻ Restart
            </button>
            <button className="btn btn-ghost" onClick={() => navigate('/schedules/new')}>
              ⏰ Schedule
            </button>
          </div>
          {isDimmable && (
            <div className="brightness-section">
              <label className="form-label">Brightness</label>
              <input type="range" min="0" max="100"
                value={isOn ? ((tel.brightness as number) ?? 100) : 0}
                onChange={(e) => sendCmd(Number(e.target.value) > 0 ? 'on' : 'off', Number(e.target.value))}
                className="brightness-slider" />
              <span className="brightness-val">{isOn ? ((tel.brightness as number) ?? 100) : 0}%</span>
            </div>
          )}
          {cmdMsg && <div className="cmd-feedback">{cmdMsg}</div>}
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <div className="card-header"><h3>Edit Device</h3></div>
          <div className="card-body">
            <div className="form-row">
              <div className="form-group"><label className="form-label">Name</label><input className="form-input" value={editName} onChange={(e) => setEditName(e.target.value)} /></div>
              <div className="form-group">
                <label className="form-label">Room</label>
                <select className="form-select" value={String(editRoom)} onChange={(e) => setEditRoom(Number(e.target.value) || '')}>
                  <option value="">— Unassigned —</option>
                  {rooms.map((r) => <option key={r.id} value={r.id}>{r.icon} {r.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Type</label>
                <select className="form-select" value={editType} onChange={(e) => setEditType(e.target.value)}>
                  <option value="relay">Relay</option><option value="dimmable">Dimmable</option>
                  <option value="rgb">RGB</option><option value="strip">LED Strip</option>
                </select>
              </div>
            </div>
            <div className="row-actions">
              <button className="btn btn-success" onClick={saveEdit}>Save</button>
              <button className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
              <button className="btn btn-danger-ghost" onClick={removeDevice}>Delete Device</button>
            </div>
          </div>
        </div>
      )}

      {/* Advanced config */}
      <button className="btn btn-ghost btn-sm" style={{ marginTop: '1rem' }} onClick={() => setShowAdvanced((v) => !v)}>
        ⚙️ Advanced settings
      </button>
      {showAdvanced && config && (
        <div className="card" style={{ marginTop: '0.5rem' }}>
          <div className="card-header"><h3>Device Configuration</h3></div>
          <div className="card-body">
            <div className="info-grid">
              <div className="info-item"><span className="info-label">PWM Freq</span><span className="info-value">{config.pwmFrequency ?? '—'}</span></div>
              <div className="info-item"><span className="info-label">PWM Channel</span><span className="info-value">{config.pwmChannel ?? '—'}</span></div>
              <div className="info-item"><span className="info-label">LED Count</span><span className="info-value">{config.ledCount ?? '—'}</span></div>
              <div className="info-item"><span className="info-label">CT Range</span><span className="info-value">{config.colorTempMin ?? '—'}–{config.colorTempMax ?? '—'} K</span></div>
              <div className="info-item"><span className="info-label">Brightness</span><span className="info-value">{config.supportsBrightness ? 'Yes' : 'No'}</span></div>
              <div className="info-item"><span className="info-label">Color</span><span className="info-value">{config.supportsColor ? 'Yes' : 'No'}</span></div>
              <div className="info-item"><span className="info-label">Effects</span><span className="info-value">{config.supportsEffects ? 'Yes' : 'No'}</span></div>
              <div className="info-item"><span className="info-label">Last Seen</span><span className="info-value">{timeAgo(device.lastTelemetryTs) || 'never'}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}