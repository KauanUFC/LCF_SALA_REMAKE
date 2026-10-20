import { useState } from 'react'
import type { Section } from '../App'
import type { Device } from '../types/types'
import { useDevices } from '../hooks/useDevices'
import { fmtBytes, fmtUptime, timeAgo } from '../lib/format'

type DevicesHook = ReturnType<typeof useDevices>

interface Props {
  device: Device
  hook: DevicesHook
  onNavigate: (section: Section) => void
}

function esc(s: unknown): string {
  if (s == null) return ''
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
}

export default function DeviceCard({ device: d, hook, onNavigate }: Props) {
  const [busy, setBusy] = useState(false)
  const [cmdMsg, setCmdMsg] = useState<string | null>(null)

  const isConnecting = d.status === 'connecting'
  const isError = d.status === 'error'
  const hasTelemetry = d.lastTelemetry != null
  const isStale = hasTelemetry && d.lastTelemetryTs > 0 && hook.isStale(d)
  const tel = d.lastTelemetry || {}

  let badge: React.ReactNode
  let connHtml: React.ReactNode

  if (isConnecting) {
    badge = <span className="badge badge-connecting"><span className="badge-dot warn" />Connecting...</span>
    connHtml = <div className="conn-status error-text">Connecting to {d.ip}...</div>
  } else if (isError) {
    badge = <span className="badge badge-offline"><span className="badge-dot danger" />Error</span>
    connHtml = (
      <div className="conn-status error-text">
        {esc(d.error)}
        <button className="btn btn-sm btn-ghost" onClick={() => hook.retryDevice(d.id)}>Retry</button>
      </div>
    )
  } else if (!hasTelemetry) {
    badge = <span className="badge badge-awaiting"><span className="badge-dot muted" />Awaiting...</span>
    connHtml = <div className="conn-status text">Connected — awaiting telemetry...</div>
  } else if (isStale) {
    badge = <span className="badge badge-stale"><span className="badge-dot danger" />Offline</span>
    const secs = Math.floor((Date.now() - d.lastTelemetryTs) / 1000)
    connHtml = <div className="conn-status error-text">No data for {secs}s</div>
  } else {
    badge = <span className="badge badge-online"><span className="badge-dot success" />Online</span>
    connHtml = <div className="conn-status text">Connected · {timeAgo(d.lastTelemetryTs)}</div>
  }

  const devIcon = isError ? '⚡' : isConnecting ? '🔌' : hasTelemetry && !isStale ? '💡' : '⚡'

  const showDetails = hasTelemetry && !isStale
  const telHtml = showDetails ? (
    <div className="info-grid">
      <div className="info-item"><span className="info-label">Device ID</span><span className="info-value blue">{esc(tel.device_id) || '---'}</span></div>
      <div className="info-item"><span className="info-label">LED</span><span className={`info-value ${tel.led_state === 'on' ? 'green' : 'red'}`}>{esc(tel.led_state) || '---'}</span></div>
      <div className="info-item"><span className="info-label">RSSI</span><span className={`info-value ${(tel.rssi ?? -100) > -60 ? 'green' : (tel.rssi ?? -100) > -80 ? 'yellow' : 'red'}`}>{tel.rssi != null ? `${tel.rssi} dBm` : '---'}</span></div>
      <div className="info-item"><span className="info-label">Free Heap</span><span className="info-value">{fmtBytes(tel.free_heap as number)}</span></div>
      <div className="info-item"><span className="info-label">Uptime</span><span className="info-value">{fmtUptime(tel.uptime_s as number)}</span></div>
      <div className="info-item"><span className="info-label">Temp</span><span className="info-value">{tel.temp_cpu != null ? `${(tel.temp_cpu as number).toFixed(1)} °C` : '---'}</span></div>
      <div className="info-item"><span className="info-label">MQTT</span><span className={`info-value ${tel.mqtt_connected ? 'green' : 'red'}`}>{tel.mqtt_connected ? 'Connected' : 'Disconnected'}</span></div>
      <div className="info-item"><span className="info-label">WiFi</span><span className={`info-value ${tel.wifi_connected ? 'green' : 'red'}`}>{tel.wifi_connected ? 'Connected' : 'Disconnected'}</span></div>
    </div>
  ) : isConnecting || isError ? null : (
    <div className="waiting">Waiting for telemetry data...</div>
  )

  const showCmds = showDetails && !isConnecting && !isError
  const ledOn = tel.led_state === 'on'

  const toggleLed = async () => {
    if (busy) return
    setBusy(true)
    setCmdMsg('Sending...')
    try {
      const next = ledOn ? 'off' : 'on'
      await hook.sendCommand(d.id, 'led', next)
      setCmdMsg(`led → ${next}`)
    } catch (e) {
      setCmdMsg(`Error: ${(e as Error).message}`)
    } finally {
      setBusy(false)
      setTimeout(() => setCmdMsg(null), 3000)
    }
  }

  const setMode = async (mode: 'http' | 'mqtt') => {
    try {
      await hook.setMode(d.id, mode)
    } catch {
      // ignore
    }
  }

  const cmdHtml = showCmds ? (
    <div className="device-card-footer">
      <label className="toggle-switch">
        <input type="checkbox" checked={ledOn} onChange={toggleLed} disabled={busy} />
        <span className={`toggle-track ${ledOn ? 'on' : ''}`}><span className="toggle-thumb" /></span>
        <span className="toggle-label">{ledOn ? 'On' : 'Off'}</span>
      </label>
      <div className="mode-group">
        <label><input type="radio" checked={d.commandMode === 'http'} onChange={() => setMode('http')} /> HTTP</label>
        <label><input type="radio" checked={d.commandMode === 'mqtt'} onChange={() => setMode('mqtt')} /> MQTT</label>
      </div>
      <div className="card-actions">
        <button className="btn btn-sm btn-ghost" onClick={() => onNavigate('ota')}>OTA</button>
        <button className="btn btn-sm btn-danger-ghost" onClick={() => { if (confirm('Remove this device?')) hook.removeDevice(d.id) }}>✕</button>
      </div>
      {cmdMsg && <div className="cmd-feedback">{esc(cmdMsg)}</div>}
    </div>
  ) : isError ? (
    <div className="device-card-footer">
      <button className="btn btn-sm btn-ghost" onClick={() => hook.retryDevice(d.id)}>Retry</button>
      <button className="btn btn-sm btn-danger-ghost" onClick={() => { if (confirm('Remove this device?')) hook.removeDevice(d.id) }}>Remove</button>
    </div>
  ) : null

  const borderClass = isError ? 'error' : isConnecting ? 'connecting' : isStale ? 'stale' : ''

  return (
    <div className={`device-card ${borderClass}`} id={`card_${d.id}`}>
      <div className="device-card-header">
        <span className="dev-icon">{devIcon}</span>
        <div className="dev-info">
          <div className="dev-name">{esc(d.name)}</div>
          <div className="dev-meta">
            {esc(d.ip)}
            {d.mac && <span> | {esc(d.mac)}</span>}
            {d.description && <span> | {esc(d.description)}</span>}
          </div>
        </div>
        {badge}
      </div>
      <div className="device-card-body">
        {connHtml}
        {telHtml}
      </div>
      {cmdHtml}
    </div>
  )
}