import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { Room } from '../types/types'

const TYPES = [
  { value: 'relay', label: 'Relay', desc: 'Simple on/off' },
  { value: 'dimmable', label: 'Dimmable', desc: 'Power + brightness' },
  { value: 'rgb', label: 'RGB', desc: 'Power + brightness + color' },
  { value: 'strip', label: 'LED Strip', desc: 'Addressable / PWM effects' },
]

export default function AddDeviceWizard() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [rooms, setRooms] = useState<Room[]>([])
  const [roomsLoaded, setRoomsLoaded] = useState(false)
  const [name, setName] = useState('')
  const [deviceType, setDeviceType] = useState('relay')
  const [ip, setIp] = useState('')
  const [roomId, setRoomId] = useState<number | ''>('')
  const [commandMode, setCommandMode] = useState<'http' | 'mqtt'>('http')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.listRooms()
      .then((r) => { setRooms(r); setRoomsLoaded(true) })
      .catch(() => { setRooms([]); setRoomsLoaded(true) })
  }, [])

  // Room-first: if there are no rooms, send the user to create one first.
  useEffect(() => {
    if (roomsLoaded && rooms.length === 0) navigate('/rooms')
  }, [roomsLoaded, rooms.length, navigate])

  const canNext = step === 1
    ? name.trim().length > 0
    : step === 2
      ? ip.trim().length > 0 && roomId !== ''
      : true

  const save = async () => {
    if (roomId === '') { setError('Please select a room'); return }
    setBusy(true); setError(null)
    try {
      const device = await api.addDevice({ name: name.trim(), ip: ip.trim(), roomId: Number(roomId), deviceType })
      if (device.id) await api.setMode(device.id, commandMode)
      navigate('/devices')
    } catch (e) {
      setError((e as Error).message); setBusy(false)
    }
  }

  if (!roomsLoaded || rooms.length === 0) {
    return <div className="section"><p className="muted">No rooms yet — redirecting to create one...</p></div>
  }

  return (
    <div className="section">
      <div className="page-header">
        <h2>Add Device</h2>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Step {step} of 3</h3>
        </div>
        <div className="card-body">
          {step === 1 && (
            <div>
              <div className="form-group">
                <label className="form-label">Device Name</label>
                <input className="form-input" value={name} placeholder="e.g. Desk Lamp" onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Device Type</label>
                <div className="type-grid">
                  {TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      className={`type-card ${deviceType === t.value ? 'selected' : ''}`}
                      onClick={() => setDeviceType(t.value)}
                    >
                      <div className="type-label">{t.label}</div>
                      <div className="type-desc">{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="form-group">
                <label className="form-label">IP Address</label>
                <input className="form-input" value={ip} placeholder="192.168.1.42" onChange={(e) => setIp(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Room</label>
                <select className="form-select" value={String(roomId)} onChange={(e) => setRoomId(Number(e.target.value) || '')}>
                  <option value="">— Select a room —</option>
                  {rooms.map((r) => <option key={r.id} value={r.id}>{r.icon} {r.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Command Mode</label>
                <div className="mode-group">
                  <label><input type="radio" checked={commandMode === 'http'} onChange={() => setCommandMode('http')} /> HTTP direct</label>
                  <label><input type="radio" checked={commandMode === 'mqtt'} onChange={() => setCommandMode('mqtt')} /> MQTT</label>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="info-grid" style={{ marginBottom: '1rem' }}>
                <div className="info-item"><span className="info-label">Name</span><span className="info-value">{name}</span></div>
                <div className="info-item"><span className="info-label">Type</span><span className="info-value">{deviceType}</span></div>
                <div className="info-item"><span className="info-label">IP</span><span className="info-value">{ip}</span></div>
                <div className="info-item"><span className="info-label">Room</span><span className="info-value">{rooms.find((r) => r.id === Number(roomId))?.name ?? '—'}</span></div>
                <div className="info-item"><span className="info-label">Mode</span><span className="info-value">{commandMode.toUpperCase()}</span></div>
              </div>
              <p className="muted" style={{ marginBottom: '1rem' }}>
                The app will probe the device at this address. If it responds, it will be added to your dashboard with reporting telemetry.
              </p>
            </div>
          )}

          {error && <div className="form-error">{error}</div>}

          <div className="wizard-actions">
            {step > 1 && <button className="btn btn-ghost" onClick={() => setStep(step - 1)}>← Back</button>}
            {step < 3 ? (
              <button className="btn btn-primary" disabled={!canNext} onClick={() => setStep(step + 1)}>Next →</button>
            ) : (
              <button className="btn btn-success" onClick={save} disabled={busy}>{busy ? 'Connecting...' : 'Save Device'}</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}