import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { useDevices as UseDevices } from '../hooks/useDevices'
import type { Device } from '../types/types'
import { fmtBytes, fmtUptime } from '../lib/format'
import DiscoveryPanel from './DiscoveryPanel'

type DevicesHook = ReturnType<typeof UseDevices>

type Tab = 'all' | 'online' | 'offline' | 'setup'

interface Props {
  hook: DevicesHook
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'online', label: 'Online' },
  { key: 'offline', label: 'Offline' },
  { key: 'setup', label: 'Needs Setup' },
]

function rssiClass(rssi: number | undefined): string {
  if (rssi == null) return ''
  if (rssi > -60) return 'green'
  if (rssi > -80) return 'yellow'
  return 'red'
}

function DeviceListItem({ device: d, hook }: { device: Device; hook: DevicesHook }) {
  const tel = d.lastTelemetry || {}
  const isOn = tel.led_state === 'on'
  const online = hook.isOnline(d)
  const offline = !online && d.status !== 'connecting'
  const [busy, setBusy] = useState(false)
  const [cmdMsg, setCmdMsg] = useState<string | null>(null)

  // Connection-dot color: green = both paths OK, yellow = only one path works
  // (degraded), red = neither.
  const httpOk = d.status === 'connected'
  const mqttOk = !!(d.lastTelemetry && !hook.isStale(d))
  const dotClass = d.status === 'connecting'
    ? 'yellow'
    : httpOk && mqttOk
      ? 'green'
      : httpOk || mqttOk
        ? 'yellow'
        : 'red'

  const wifiOk = online && typeof tel.wifi_connected === 'boolean' ? tel.wifi_connected : null
  const mqttOkTel = online && typeof tel.mqtt_connected === 'boolean' ? tel.mqtt_connected : null

  const toggle = async () => {
    if (busy) return
    setBusy(true)
    try {
      await hook.sendCommand(d.id, 'led', isOn ? 'off' : 'on')
    } catch {
      // ignore transient failures; SSE will reconcile state
    } finally {
      setBusy(false)
    }
  }

  const setMode = async (mode: 'http' | 'mqtt') => {
    try {
      await hook.setMode(d.id, mode)
    } catch {
      // ignore
    }
  }

  const doRetry = async () => {
    if (busy) return
    setBusy(true)
    try {
      await hook.retryDevice(d.id)
    } catch {
      // ignore
    } finally {
      setBusy(false)
    }
  }

  const doRestart = async () => {
    if (busy) return
    if (!confirm(`Restart ${d.name}? The device will reboot and may take ~30s to reconnect.`)) return
    setBusy(true); setCmdMsg('Restarting...')
    try {
      await api.restartDevice(d.id)
      setCmdMsg('Restart command sent — device will reboot.')
    } catch (e) {
      setCmdMsg(`Restart failed: ${(e as Error).message}`)
    } finally {
      setTimeout(() => { setBusy(false); setCmdMsg(null) }, 5000)
    }
  }

  return (
    <div className={`device-card ${offline ? 'stale' : ''}`}>
      <div className="device-card-header">
        <span className="dev-icon">💡</span>
        <div className="dev-info">
          <Link to={`/devices/${d.id}`} className="dev-name">
            <span className={`dot connection-dot ${dotClass}`} title={d.status === 'connecting' ? 'Connecting...' : offline ? 'Offline' : httpOk && mqttOk ? 'Online' : 'Degraded (one path)'} />
            {d.name}
          </Link>
          <div className="dev-meta">
            {d.ip || '—'} {d.mac && <span>| {d.mac}</span>} · {d.deviceType}
          </div>
        </div>
      </div>
      <div className="device-card-body">
        <div className="compact-metrics">
          <div className="metric"><span className="metric-label">LED</span><span className={`metric-value ${isOn ? 'green' : 'red'}`}>{isOn ? 'ON' : 'OFF'}</span></div>
          <div className="metric"><span className="metric-label">RSSI</span><span className={`metric-value ${rssiClass(tel.rssi as number | undefined)}`}>{tel.rssi != null ? `${tel.rssi} dBm` : '---'}</span></div>
          <div className="metric"><span className="metric-label">Heap</span><span className="metric-value">{fmtBytes(tel.free_heap as number)}</span></div>
          <div className="metric"><span className="metric-label">Uptime</span><span className="metric-value">{fmtUptime(tel.uptime_s as number)}</span></div>
        </div>
      </div>
      <div className="device-card-footer">
        <label className="toggle-switch">
          <input type="checkbox" checked={isOn} onChange={toggle} disabled={busy || !online} />
          <span className={`toggle-track ${isOn ? 'on' : ''}`}><span className="toggle-thumb" /></span>
          <span className="toggle-label">{isOn ? 'On' : 'Off'}</span>
        </label>
        <div className="device-status">
          <span className="status-item"><span className={`dot ${online ? 'green' : 'red'}`} />{online ? 'Online' : 'Offline'}</span>
          <span className="status-item"><span className={`dot ${wifiOk === null ? 'muted' : wifiOk ? 'green' : 'red'}`} />{wifiOk === null ? 'WiFi —' : wifiOk ? 'WiFi OK' : 'WiFi Offline'}</span>
          <span className="status-item"><span className={`dot ${mqttOkTel === null ? 'muted' : mqttOkTel ? 'green' : 'red'}`} />{mqttOkTel === null ? 'Dev MQTT —' : mqttOkTel ? 'Dev MQTT Connected' : 'Dev MQTT Disconnected'}</span>
        </div>
        <div className="mode-group mode-group-inline">
          <label><input type="radio" checked={d.commandMode === 'http'} onChange={() => setMode('http')} /> HTTP</label>
          <label><input type="radio" checked={d.commandMode === 'mqtt'} onChange={() => setMode('mqtt')} /> MQTT</label>
        </div>
        {offline && (
          <button className="btn btn-sm btn-ghost" onClick={doRetry} disabled={busy}>↻ {busy ? 'Retrying...' : 'Retry'}</button>
        )}
        <Link to={`/devices/${d.id}`} className="btn btn-sm btn-ghost">Details</Link>
        <button className="btn btn-sm btn-ghost" onClick={doRestart} disabled={busy}>⏻</button>
        <button className="btn btn-sm btn-danger-ghost" onClick={() => { if (confirm(`Remove ${d.name}?`)) hook.removeDevice(d.id) }}>✕</button>
      </div>
      {cmdMsg && <div className="cmd-feedback" style={{ padding: '0 1.125rem 0.75rem' }}>{cmdMsg}</div>}
    </div>
  )
}

export default function Devices({ hook }: Props) {
  const [tab, setTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')
  const [showDiscovery, setShowDiscovery] = useState(false)

  const { devices } = hook
  const isOnline = hook.isOnline
  const isOffline = (d: Device) => !isOnline(d) && d.status !== 'connecting'

  const filtered = devices.filter((d) => {
    if (tab === 'online' && !isOnline(d)) return false
    if (tab === 'offline' && !isOffline(d)) return false
    if (tab === 'setup' && d.status !== 'connecting') return false
    if (search && !`${d.name} ${d.ip ?? ''} ${d.mac ?? ''}`.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const countFor = (t: Tab) => {
    if (t === 'all') return devices.length
    if (t === 'online') return devices.filter(isOnline).length
    if (t === 'offline') return devices.filter(isOffline).length
    return devices.filter((d) => d.status === 'connecting').length
  }

  return (
    <div className="section">
      <div className="page-header">
        <h2>Devices</h2>
        <div className="header-actions">
          <button className="btn btn-ghost" onClick={() => setShowDiscovery((v) => !v)}>
            {showDiscovery ? 'Close Discovery' : '🔍 Discover'}
          </button>
          <Link to="/add-device" className="btn btn-primary">+ Add Device</Link>
        </div>
      </div>

      {showDiscovery && <DiscoveryPanel hook={{ addDevice: hook.addDevice }} />}

      <div className="filter-bar">
        {TABS.map((t) => (
          <button key={t.key} className={`btn btn-sm ${tab === t.key ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab(t.key)}>
            {t.label} ({countFor(t.key)})
          </button>
        ))}
        <input className="form-input search-input" placeholder="Search name / IP / MAC..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📡</div>
          <h3>No devices</h3>
          <p>Add a device or use discovery to find ESP32s on your network.</p>
        </div>
      ) : (
        <div className="device-grid" style={{ marginTop: '1rem' }}>
          {filtered.map((d) => <DeviceListItem key={d.id} device={d} hook={hook} />)}
        </div>
      )}
    </div>
  )
}