import { useEffect, useState } from 'react'
import type { ApiInfo } from '../types/types'

interface Props {
  mqttConnected: boolean
  info: ApiInfo | null
}

export default function SettingsSection({ mqttConnected, info }: Props) {
  const [theme, setTheme] = useState(() => localStorage.getItem('lcflight_theme') || 'dark')

  useEffect(() => {
    document.documentElement.className = theme
    localStorage.setItem('lcflight_theme', theme)
  }, [theme])

  return (
    <div className="section">
      <div className="page-header"><h2>Settings</h2></div>

      <div className="card settings-card">
        <div className="card-header"><h3>Appearance</h3></div>
        <div className="card-body">
          <div className="setting-item">
            <div>
              <div className="setting-label">Theme</div>
              <div className="setting-desc">Switch between dark and light mode</div>
            </div>
            <select
              className="form-select theme-select"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card settings-card">
        <div className="card-header"><h3>Broker</h3></div>
        <div className="card-body">
          <div className="setting-item">
            <div>
              <div className="setting-label">MQTT Connection</div>
              <div className="setting-desc">Status of the MQTT broker connection</div>
            </div>
            <span
              className="setting-badge"
              style={mqttConnected ? { color: 'var(--success)' } : { color: 'var(--danger)' }}
            >
              {mqttConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>

      <div className="card settings-card">
        <div className="card-header"><h3>About</h3></div>
        <div className="card-body">
          <div className="info-grid">
            <div className="info-item"><span className="info-label">Version</span><span className="info-value">{info?.version ?? '---'}</span></div>
            <div className="info-item"><span className="info-label">Backend</span><span className="info-value">{info?.backend ?? '---'}</span></div>
            <div className="info-item"><span className="info-label">Firmware</span><span className="info-value">{info?.firmware ?? '---'}</span></div>
            <div className="info-item"><span className="info-label">Protocol</span><span className="info-value">{info?.protocol ?? '---'}</span></div>
          </div>
        </div>
      </div>
    </div>
  )
}