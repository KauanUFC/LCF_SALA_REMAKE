import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import { useBrokerStatus } from '../hooks/useBrokerStatus'
import type { AppPreferences } from '../types/types'

function applyTheme(theme: string) {
  document.documentElement.className = theme
  try { localStorage.setItem('lcflight_theme', theme) } catch { /* ignore */ }
}

export default function SettingsSection() {
  const { mqttConnected, info } = useBrokerStatus()
  const [tab, setTab] = useState<'prefs' | 'about'>('prefs')
  const [prefs, setPrefs] = useState<AppPreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    setLoading(true); setError(null)
    api.getPreferences()
      .then((p) => { setPrefs(p); applyTheme(p.theme) })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    // Apply the locally cached theme immediately to avoid a flash of the wrong theme,
    // then reconcile with the server value.
    try {
      const cached = localStorage.getItem('lcflight_theme')
      if (cached) applyTheme(cached)
    } catch { /* ignore */ }
    load()
  }, [load])

  const updatePref = async (patch: Partial<AppPreferences>) => {
    if (!prefs || busy) return
    setBusy(true); setError(null)
    const next = { ...prefs, ...patch }
    // Apply theme optimistically for instant feedback.
    if (patch.theme) applyTheme(patch.theme)
    try {
      const persisted = await api.updatePreferences(next)
      setPrefs(persisted)
      if (persisted.theme) applyTheme(persisted.theme)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setError((e as Error).message)
      // Revert optimistic theme on failure.
      if (patch.theme) applyTheme(prefs.theme)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="section">
      <div className="page-header">
        <h2>Settings</h2>
        {saved && <span className="badge badge-online">Saved</span>}
      </div>

      <div className="settings-tabs">
        <button className={`btn btn-sm ${tab === 'prefs' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('prefs')}>Preferences</button>
        <button className={`btn btn-sm ${tab === 'about' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('about')}>About</button>
      </div>

      {error && <div className="form-error" style={{ marginBottom: '0.75rem' }}>{error}</div>}

      {tab === 'prefs' && loading && <p className="muted">Loading preferences...</p>}

      {tab === 'prefs' && !loading && !prefs && (
        <div className="empty-state">
          <div className="empty-icon">⚙️</div>
          <h3>Could not load settings</h3>
          <button className="btn btn-primary" onClick={load}>Retry</button>
        </div>
      )}

      {tab === 'prefs' && !loading && prefs && (
        <>
          <div className="card settings-card">
            <div className="card-header"><h3>Appearance</h3></div>
            <div className="card-body">
              <div className="setting-item">
                <div><div className="setting-label">Theme</div><div className="setting-desc">Dark or light mode</div></div>
                <select className="form-select theme-select" value={prefs.theme} disabled={busy} onChange={(e) => updatePref({ theme: e.target.value })}>
                  <option value="dark">Dark</option><option value="light">Light</option>
                </select>
              </div>
            </div>
          </div>

          <div className="card settings-card">
            <div className="card-header"><h3>Notifications</h3></div>
            <div className="card-body">
              <div className="setting-item">
                <div><div className="setting-label">Device offline alerts</div><div className="setting-desc">Show an alert when a device stops reporting</div></div>
                <label className="toggle-switch">
                  <input type="checkbox" checked={prefs.notifyOffline} disabled={busy} onChange={(e) => updatePref({ notifyOffline: e.target.checked })} />
                  <span className={`toggle-track ${prefs.notifyOffline ? 'on' : ''}`}><span className="toggle-thumb" /></span>
                </label>
              </div>
              <div className="setting-item">
                <div><div className="setting-label">Offline threshold</div><div className="setting-desc">Minutes before a device is flagged offline</div></div>
                <select className="form-select theme-select" value={prefs.offlineThresholdMinutes} disabled={busy} onChange={(e) => updatePref({ offlineThresholdMinutes: Number(e.target.value) })}>
                  {[1, 5, 10, 30, 60].map((m) => <option key={m} value={m}>{m} min</option>)}
                </select>
              </div>
              <div className="setting-item">
                <div><div className="setting-label">Schedule failure alerts</div><div className="setting-desc">Mark a scheduled run as failed when it does not complete</div></div>
                <label className="toggle-switch">
                  <input type="checkbox" checked={prefs.notifyFailures} disabled={busy} onChange={(e) => updatePref({ notifyFailures: e.target.checked })} />
                  <span className={`toggle-track ${prefs.notifyFailures ? 'on' : ''}`}><span className="toggle-thumb" /></span>
                </label>
              </div>
            </div>
          </div>

          <div className="card settings-card">
            <div className="card-header"><h3>Broker</h3></div>
            <div className="card-body">
              <div className="setting-item">
                <div><div className="setting-label">MQTT Connection</div><div className="setting-desc">Status of the broker link</div></div>
                <span className="setting-badge" style={{ color: mqttConnected ? 'var(--success)' : 'var(--danger)' }}>{mqttConnected ? 'Connected' : 'Disconnected'}</span>
              </div>
            </div>
          </div>
        </>
      )}

      {tab === 'about' && info && (
        <div className="card settings-card">
          <div className="card-header"><h3>About</h3></div>
          <div className="card-body">
            <div className="info-grid">
              <div className="info-item"><span className="info-label">Version</span><span className="info-value">{info.version ?? '---'}</span></div>
              <div className="info-item"><span className="info-label">Backend</span><span className="info-value">{info.backend ?? '---'}</span></div>
              <div className="info-item"><span className="info-label">Firmware</span><span className="info-value">{info.firmware ?? '---'}</span></div>
              <div className="info-item"><span className="info-label">Protocol</span><span className="info-value">{info.protocol ?? '---'}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}