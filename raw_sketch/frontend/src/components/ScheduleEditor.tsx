import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { api } from '../api/client'
import type { Device, Room } from '../types/types'

const DAY_LABELS: { value: number; label: string }[] = [
  { value: 0, label: 'Sun' }, { value: 1, label: 'Mon' }, { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' }, { value: 4, label: 'Thu' }, { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
]

const DAY_OPTIONS = [
  { label: 'Once', value: 'once' },
  { label: 'Every day', value: 'everyday' },
  { label: 'Weekdays', value: 'weekdays' },
]

export default function ScheduleEditor() {
  const { id } = useParams<{ id: string }>()
  const isEdit = id !== undefined && id !== 'new'
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [action, setAction] = useState<'power' | 'brightness'>('power')
  const [triggerTime, setTriggerTime] = useState('20:00')
  const [scope, setScope] = useState<'room' | 'devices'>('room')
  const [roomId, setRoomId] = useState<number | ''>('')
  const [state, setState] = useState<'on' | 'off'>('on')
  const [brightness, setBrightness] = useState(80)
  const [dayMode, setDayMode] = useState('once')
  const [customDays, setCustomDays] = useState<number[]>([])
  const [deviceIds, setDeviceIds] = useState<number[]>([])
  const [enabled, setEnabled] = useState(true)
  const [rooms, setRooms] = useState<Room[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.listRooms().then(setRooms).catch(() => setRooms([]))
    api.listDevices().then(setDevices).catch(() => setDevices([]))
    if (isEdit) {
      api.getSchedule(Number(id)).then((s) => {
        setName(s.name)
        setAction(s.action)
        setTriggerTime(s.triggerTime)
        setScope(s.scope)
        setRoomId(s.roomId ?? '')
        setState(s.state ?? 'on')
        setBrightness(s.brightness ?? 80)
        setEnabled(s.enabled)
        if (Array.isArray(s.deviceIds)) {
          setDeviceIds(s.deviceIds)
        }
        if (s.repeatDays && s.repeatDays.trim().length > 0) {
          const days = s.repeatDays.split(',').map((n) => parseInt(n, 10)).filter((n) => !Number.isNaN(n))
          setCustomDays(days)
          setDayMode(days.length === 7 ? 'everyday' : days.length === 5 && days.join(',') === '1,2,3,4,5' ? 'weekdays' : 'custom')
          if (days.length !== 7 && !(days.length === 5 && days.join(',') === '1,2,3,4,5')) {
            setDayMode('custom')
          }
        }
      }).catch(() => navigate('/schedules'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const computeRepeatDays = (): string => {
    if (dayMode === 'once') return ''
    if (dayMode === 'everyday') return '0,1,2,3,4,5,6'
    if (dayMode === 'weekdays') return '1,2,3,4,5'
    return customDays.sort().join(',')
  }

  const save = async () => {
    setError(null)
    if (!name.trim() || !triggerTime) {
      setError('Name and time are required')
      return
    }
    if (!/^\d{2}:\d{2}$/.test(triggerTime)) {
      setError('Time must be HH:MM (24h)')
      return
    }
    if (scope === 'room' && roomId === '') {
      setError('Select a room (or choose "Selected devices")')
      return
    }
    if (scope === 'devices' && deviceIds.length === 0) {
      setError('Select at least one device')
      return
    }

    const payload = {
      name: name.trim(),
      action,
      triggerTime,
      scope,
      roomId: scope === 'room' ? Number(roomId) : null,
      repeatDays: computeRepeatDays(),
      state: action === 'power' ? state : null,
      brightness: action === 'brightness' ? brightness : null,
      enabled,
      deviceIds: scope === 'devices' ? deviceIds : [],
    }

    setBusy(true)
    try {
      if (isEdit) await api.updateSchedule(Number(id), payload)
      else await api.createSchedule(payload)
      navigate('/schedules')
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  const toggleDay = (d: number) => {
    setCustomDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d])
  }

  return (
    <div className="section">
      <div className="page-header">
        <h2>{isEdit ? 'Edit Schedule' : 'New Schedule'}</h2>
        <Link to="/schedules" className="btn btn-ghost btn-sm">← Back</Link>
      </div>

      <div className="card">
        <div className="card-header"><h3>Schedule</h3></div>
        <div className="card-body">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Name</label>
              <input className="form-input" value={name} placeholder="e.g. Turn off at night" onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Time (HH:MM)</label>
              <input className="form-input" type="time" value={triggerTime} onChange={(e) => setTriggerTime(e.target.value)} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Action</label>
              <select className="form-select" value={action} onChange={(e) => setAction(e.target.value as 'power' | 'brightness')}>
                <option value="power">Power On/Off</option>
                <option value="brightness">Set Brightness</option>
              </select>
            </div>
            {action === 'power' ? (
              <div className="form-group">
                <label className="form-label">State</label>
                <select className="form-select" value={state} onChange={(e) => setState(e.target.value as 'on' | 'off')}>
                  <option value="on">On</option>
                  <option value="off">Off</option>
                </select>
              </div>
            ) : (
              <div className="form-group">
                <label className="form-label">Brightness: {brightness}%</label>
                <input type="range" min="0" max="100" value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} className="brightness-slider" />
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Scope</label>
            <div className="mode-group">
              <label><input type="radio" checked={scope === 'room'} onChange={() => setScope('room')} /> Whole Room</label>
              <label><input type="radio" checked={scope === 'devices'} onChange={() => setScope('devices')} /> Selected Devices</label>
            </div>
          </div>

          {scope === 'room' ? (
            <div className="form-group">
              <label className="form-label">Room</label>
              <select className="form-select" value={String(roomId)} onChange={(e) => setRoomId(Number(e.target.value) || '')}>
                <option value="">— Select room —</option>
                {rooms.map((r) => <option key={r.id} value={r.id}>{r.icon} {r.name}</option>)}
              </select>
            </div>
          ) : (
            <div className="form-group">
              <label className="form-label">Devices</label>
              <div className="device-checklist">
                {devices.map((d) => (
                  <label key={d.id} className="device-check-item">
                    <input
                      type="checkbox"
                      checked={deviceIds.includes(d.id)}
                      onChange={(e) => {
                        setDeviceIds((prev) =>
                          e.target.checked
                            ? [...prev, d.id]
                            : prev.filter((x) => x !== d.id),
                        )
                      }}
                    />
                    <span>{d.name}</span>
                    {d.ip && <span className="muted small">({d.ip})</span>}
                  </label>
                ))}
              </div>
              <p className="muted small">Select at least one device.</p>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Repeat</label>
            <select className="form-select theme-select" value={dayMode} onChange={(e) => setDayMode(e.target.value)}>
              {DAY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {dayMode === 'custom' && (
              <div className="day-picker">
                {DAY_LABELS.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    className={`day-chip ${customDays.includes(d.value) ? 'active' : ''}`}
                    onClick={() => toggleDay(d.value)}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="toggle-switch" style={{ marginTop: '0.5rem' }}>
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
              <span className={`toggle-track ${enabled ? 'on' : ''}`}><span className="toggle-thumb" /></span>
              <span className="toggle-label">Enabled</span>
            </label>
          </div>

          {error && <div className="form-error">{error}</div>}

          <button className="btn btn-success" onClick={save} disabled={busy}>
            {busy ? 'Saving...' : 'Save Schedule'}
          </button>
        </div>
      </div>
    </div>
  )
}