import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { Device, Schedule } from '../types/types'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function repeatLabel(repeatDays: string | null): string {
  if (!repeatDays || repeatDays.trim().length === 0) return 'Once'
  const days = repeatDays.split(',').map((n) => parseInt(n, 10)).filter((n) => !Number.isNaN(n))
  if (days.length === 7) return 'Every day'
  if (days.length === 5 && days.join(',') === '1,2,3,4,5') return 'Weekdays'
  return days.map((d) => DAY_LABELS[d]).join(', ')
}

export default function SchedulesSection() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [devicesById, setDevicesById] = useState<Record<number, Device>>({})
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const load = async () => {
    try {
      setSchedules(await api.listSchedules())
    } catch { /* ignore */ }
    try {
      const devs = await api.listDevices()
      setDevicesById(Object.fromEntries(devs.map((d) => [d.id, d])))
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const scopeLabel = (s: Schedule): string => {
    if (s.scope !== 'devices') return `Room #${s.roomId ?? '—'}`
    if (s.deviceIds.length === 0) return 'Selected devices'
    const names = s.deviceIds.map((id) => devicesById[id]?.name || `#${id}`)
    return `Selected (${names.join(', ')})`
  }

  const toggle = async (id: number) => {
    await api.toggleSchedule(id)
    load()
  }

  const remove = async (s: Schedule) => {
    if (!confirm(`Delete schedule "${s.name}"?`)) return
    await api.deleteSchedule(s.id)
    load()
  }

  return (
    <div className="section">
      <div className="page-header">
        <h2>Schedules</h2>
        <button className="btn btn-primary" onClick={() => navigate('/schedules/new')}>+ New Schedule</button>
      </div>

      {loading ? <p>Loading...</p> : null}

      {!loading && schedules.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">⏰</div>
          <h3>No schedules yet</h3>
          <p>Create a schedule to automate your lights.</p>
          <button className="btn btn-primary" onClick={() => navigate('/schedules/new')}>+ New Schedule</button>
        </div>
      )}

      {schedules.length > 0 && (
        <div className="card">
          <table className="schedule-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Time</th>
                <th>Action</th>
                <th>Scope</th>
                <th>Repeat</th>
                <th>Last Run</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((s) => (
                <tr key={s.id} className={!s.enabled ? 'row-disabled' : ''}>
                  <td className="schedule-name">{s.name}</td>
                  <td>{s.triggerTime}</td>
                  <td>
                    {s.action === 'power'
                      ? (s.state === 'on' ? '🏠 Turn On' : '⏻ Turn Off')
                      : `☀️ Brightness ${s.brightness ?? 0}%`}
                  </td>
                  <td>{scopeLabel(s)}</td>
                  <td>{repeatLabel(s.repeatDays)}</td>
                  <td>{s.lastRun ? new Date(s.lastRun).toLocaleTimeString() : '—'}</td>
                  <td>
                    <span className={`badge ${s.lastRunStatus === 'ok' ? 'badge-online' : s.lastRunStatus === 'failed' ? 'badge-offline' : 'badge-awaiting'}`}>
                      {s.lastRunStatus === 'ok' ? 'OK' : s.lastRunStatus === 'failed' ? 'Failed' : 'Pending'}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className={`btn btn-sm ${s.enabled ? 'btn-ghost' : 'btn-primary'}`}
                        onClick={() => toggle(s.id)}
                      >
                        {s.enabled ? 'Pause' : 'Enable'}
                      </button>
                      <button className="btn btn-sm btn-ghost" onClick={() => navigate(`/schedules/${s.id}/edit`)}>Edit</button>
                      <button className="btn btn-sm btn-danger-ghost" onClick={() => remove(s)}>✕</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}