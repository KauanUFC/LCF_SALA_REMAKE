import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api/client'
import type { useDevices as UseDevices } from '../hooks/useDevices'
import type { Room, Device } from '../types/types'
import DiscoveryPanel from './DiscoveryPanel'

type DevicesHook = ReturnType<typeof UseDevices>

interface Props {
  hook: DevicesHook
}

export default function RoomDetail({ hook }: Props) {
  const { id } = useParams<{ id: string }>()
  const [room, setRoom] = useState<Room | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showDiscovery, setShowDiscovery] = useState(false)
  const [devName, setDevName] = useState('')
  const [devIp, setDevIp] = useState('')
  const [devType, setDevType] = useState<string>('relay')

  const roomId = Number(id)

  const loadRoom = async () => {
    try {
      const r = await api.getRoom(roomId)
      setRoom(r)
    } catch { setRoom(null) }
    setLoading(false)
  }

  useEffect(() => { loadRoom() }, [roomId])

  const addDevice = async () => {
    if (!devName.trim() || !devIp.trim()) return
    try {
      await hook.addDevice({ name: devName.trim(), ip: devIp.trim(), roomId, deviceType: devType })
      setDevName('')
      setDevIp('')
      setDevType('relay')
      setShowForm(false)
      loadRoom()
    } catch (e) { alert((e as Error).message) }
  }

  const removeDevice = async (device: Device) => {
    if (!confirm(`Remove ${device.name}?`)) return
    await hook.removeDevice(device.id)
    loadRoom()
  }

  const devsInRoom = hook.devices.filter((d) => d.roomId === roomId)

  if (loading) return <div className="section"><p>Loading...</p></div>
  if (!room) return <div className="section"><p>Room not found. <Link to="/">Back to dashboard</Link></p></div>

  return (
    <div className="section">
      <div className="page-header">
        <h2>{room.icon} {room.name}</h2>
        <Link to="/" className="btn btn-ghost btn-sm">← Back</Link>
      </div>

      <div className="toolbar">
        <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Close' : '+ Add Device'}
        </button>
        <button className="btn btn-ghost" onClick={() => setShowDiscovery((v) => !v)}>
          🔍 Discover
        </button>
      </div>

      {showForm && (
        <div className="add-form-wrap">
          <div className="add-form">
            <div className="field">
              <label>Name</label>
              <input type="text" value={devName} placeholder="e.g. Desk Lamp" onChange={(e) => setDevName(e.target.value)} />
            </div>
            <div className="field">
              <label>IP</label>
              <input type="text" value={devIp} placeholder="192.168.1.42" onChange={(e) => setDevIp(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addDevice()} />
            </div>
            <div className="field" style={{ maxWidth: '120px' }}>
              <label>Type</label>
              <select className="form-select" value={devType} onChange={(e) => setDevType(e.target.value)}>
                <option value="relay">Relay</option>
                <option value="dimmable">Dimmable</option>
                <option value="rgb">RGB</option>
                <option value="strip">LED Strip</option>
              </select>
            </div>
            <div className="btn-row">
              <button className="btn btn-success" onClick={addDevice}>Connect</button>
            </div>
          </div>
        </div>
      )}

      {showDiscovery && <DiscoveryPanel hook={{ addDevice: (data) => hook.addDevice({ ...data, roomId }) }} />}

      {devsInRoom.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">💡</div>
          <h3>No devices in this room</h3>
          <p>Add a device to get started.</p>
        </div>
      ) : (
        <div className="device-grid">
          {devsInRoom.map((d) => (
            <div key={d.id} className="device-card">
              <div className="device-card-header">
                <span className="dev-icon">💡</span>
                <div className="dev-info">
                  <Link to={`/devices/${d.id}`} className="dev-name">{d.name}</Link>
                  <div className="dev-meta">
                    {d.ip} {d.mac && <span>| {d.mac}</span>} · {d.deviceType}
                  </div>
                </div>
                <span className={`badge ${d.status === 'connecting' ? 'badge-connecting' : hook.isOnline(d) ? 'badge-online' : 'badge-offline'}`}>
                  {d.status === 'connecting' ? 'Connecting...' : hook.isOnline(d) ? 'Online' : 'Offline'}
                </span>
              </div>
              <div className="device-card-footer">
                <Link to={`/devices/${d.id}`} className="btn btn-sm btn-primary">Control</Link>
                <button className="btn btn-sm btn-danger-ghost" onClick={() => removeDevice(d)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}