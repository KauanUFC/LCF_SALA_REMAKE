import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { api } from '../api/client'
import type { Device, Scene, SceneSetting } from '../types/types'

interface DraftRow {
  deviceId: number
  deviceName: string
  power: boolean
  brightness: number
}

export default function SceneEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = id != null && id !== 'new'

  const [scene, setScene] = useState<Scene | null>(null)
  const [name, setName] = useState('')
  const [rows, setRows] = useState<DraftRow[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.listDevices().then(setDevices).catch(() => setDevices([]))
    api.listScenes().then((list) => {
      const sc = list.find((s) => s.id === Number(id))
      if (sc && sc.settings.length > 0) {
        setRows(sc.settings.map((s) => ({
          deviceId: s.deviceId, deviceName: '',
          power: s.power, brightness: s.brightness ?? 100,
        })))
      }
    }).catch(() => {})
    if (isEdit) {
      api.getScene(Number(id)).then((s) => {
        setScene(s); setName(s.name)
      }).catch(() => navigate('/scenes'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    // enrich rows with device names + dimmable capability config
    const names: Record<number, string> = {}
    const caps: Record<number, boolean> = {}
    for (const d of devices) { names[d.id] = d.name; caps[d.id] = ['dimmable', 'rgb', 'strip'].includes(d.deviceType) }
    setRows((prev) => prev.map((r) => ({ ...r, deviceName: names[r.deviceId] ?? `Device #${r.deviceId}` })))
  }, [devices])

  // When editing an empty scene, offer devices to add
  const addDeviceRooms = (device: Device) => {
    if (rows.some((r) => r.deviceId === device.id)) return
    setRows((prev) => [...prev, { deviceId: device.id, deviceName: device.name, power: false, brightness: 100 }])
  }

  const updateRow = (deviceId: number, patch: Partial<DraftRow>) => {
    setRows((prev) => prev.map((r) => r.deviceId === deviceId ? { ...r, ...patch } : r))
  }

  const removeRow = (deviceId: number) => {
    setRows((prev) => prev.filter((r) => r.deviceId !== deviceId))
  }

  const buildSettings = (): SceneSetting[] =>
    rows.map((r) => ({ deviceId: r.deviceId, power: r.power, brightness: r.brightness }))

  const save = async () => {
    setError(null)
    if (!name.trim()) { setError('Scene name is required'); return }
    setBusy(true)
    try {
      if (isEdit) {
        await api.updateScene(Number(id), { name: name.trim(), settings: buildSettings() })
      } else {
        await api.createScene({ name: name.trim(), settings: buildSettings() })
      }
      navigate('/scenes')
    } catch (e) {
      setError((e as Error).message); setBusy(false)
    }
  }

  return (
    <div className="section">
      <div className="page-header">
        <h2>{isEdit ? `Edit "${scene?.name ?? 'Scene'}"` : 'New Scene'}</h2>
        <Link to="/scenes" className="btn btn-ghost btn-sm">← Back</Link>
      </div>

      <div className="card">
        <div className="card-header"><h3>Scene</h3></div>
        <div className="card-body">
          <div className="form-group">
            <label className="form-label">Scene Name</label>
            <input className="form-input" value={name} placeholder="e.g. Relax" onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">Devices (add from available)</label>
            <select className="form-select" value="" onChange={(e) => { const d = devices.find((x) => x.id === Number(e.target.value)); if (d) addDeviceRooms(d) }}>
              <option value="">— Add a device to this scene —</option>
              {devices.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.deviceType})</option>)}
            </select>
          </div>

          {rows.length === 0 ? (
            <p className="muted" style={{ margin: '1rem 0' }}>Add devices to the scene to configure their state.</p>
          ) : (
            <div className="scene-rows">
              {rows.map((r) => {
                                const dimmable = ['dimmable', 'rgb', 'strip'].includes(devices.find((d) => d.id === r.deviceId)?.deviceType ?? '')
                return (
                  <div key={r.deviceId} className="scene-row">
                    <div className="scene-row-info">
                      <span>{r.deviceName}</span>
                    </div>
                    <label className="toggle-switch">
                      <input type="checkbox" checked={r.power} onChange={(e) => updateRow(r.deviceId, { power: e.target.checked })} />
                      <span className={`toggle-track ${r.power ? 'on' : ''}`}><span className="toggle-thumb" /></span>
                      <span className="toggle-label">{r.power ? 'On' : 'Off'}</span>
                    </label>
                    {dimmable && (
                      <div className="scene-row-slider">
                        <input type="range" min="0" max="100" value={r.brightness} onChange={(e) => updateRow(r.deviceId, { brightness: Number(e.target.value), power: Number(e.target.value) > 0 })} />
                        <span className="brightness-val">{r.brightness}%</span>
                      </div>
                    )}
                    <button className="btn btn-sm btn-danger-ghost" onClick={() => removeRow(r.deviceId)}>✕</button>
                  </div>
                )
              })}
            </div>
          )}

          {error && <div className="form-error">{error}</div>}

          <div className="row-actions" style={{ marginTop: '1rem' }}>
            <button className="btn btn-success" onClick={save} disabled={busy}>{busy ? 'Saving...' : 'Save Scene'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}