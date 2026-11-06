import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useBrokerStatus } from '../hooks/useBrokerStatus'
import type { useDevices as UseDevices } from '../hooks/useDevices'
import type { Device, Room } from '../types/types'
import AlertsList from './AlertsList'
import RoomCard from './RoomCard'

type DevicesHook = ReturnType<typeof UseDevices>

interface Props {
  hook: DevicesHook
}

export default function Dashboard({ hook }: Props) {
  const [rooms, setRooms] = useState<Room[]>([])
  const [showNewRoom, setShowNewRoom] = useState(false)
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('💡')
  const navigate = useNavigate()
  const { mqttConnected } = useBrokerStatus()

  const loadRooms = async () => {
    try { setRooms(await api.listRooms()) } catch { setRooms([]) }
  }

  useEffect(() => { loadRooms() }, [])

  const { devices, isOnline } = hook
  const stats = {
    total: devices.length,
    online: devices.filter(isOnline).length,
    offline: devices.filter((d) => !isOnline(d) && d.status !== 'connecting').length,
    setup: devices.filter((d) => d.status === 'connecting').length,
  }

  // Dashboard-wide Broker + WiFi status
  const DASH_FRESH_MS = 20000
  const dashFresh = (d: Device) => d.lastTelemetryTs > 0 && Date.now() - d.lastTelemetryTs <= DASH_FRESH_MS
  const anyFresh = devices.some(dashFresh)
  const wifiFreshCount = devices.filter(dashFresh).length
  const wifiOkCount = devices.filter((d) => dashFresh(d) && d.lastTelemetry?.wifi_connected === true).length
  const wifiAll = wifiOkCount === wifiFreshCount && anyFresh
  const wifiSome = devices.some((d) => dashFresh(d) && d.lastTelemetry?.wifi_connected === true)
  const wifiColor = anyFresh ? (wifiAll ? 'green' : wifiSome ? 'yellow' : 'red') : 'muted'
  const wifiLabel = wifiAll ? 'OK' : wifiSome ? 'Mixed' : '—'

  const createRoom = async () => {
    if (!newName.trim()) return
    try {
      await api.createRoom({ name: newName.trim(), icon: newIcon })
      setNewName(''); setShowNewRoom(false); loadRooms()
    } catch (e) { alert((e as Error).message) }
  }

  const deleteRoom = async (id: number) => {
    if (!confirm('Delete this room? Devices will be unassigned.')) return
    await api.deleteRoom(id)
    loadRooms()
  }

  return (
    <div className="section">
      <div className="page-header">
        <h2>Dashboard</h2>
        <span className="muted">{rooms.length} rooms · {devices.length} devices</span>
      </div>

      {stats.total > 0 && (
        <div className="stat-grid" style={{ marginBottom: '1.5rem' }}>
          <div className="stat-card total"><div className="stat-count">{stats.total}</div><div className="stat-label">Total</div></div>
          <div className="stat-card online"><div className="stat-count">{stats.online}</div><div className="stat-label">Online</div></div>
          <div className="stat-card offline"><div className="stat-count">{stats.offline}</div><div className="stat-label">Offline</div></div>
          <div className="stat-card needs-setup"><div className="stat-count">{stats.setup}</div><div className="stat-label">Needs Setup</div></div>
          <div className="stat-card" style={{ borderColor: mqttConnected ? 'var(--success)' : 'var(--danger)' }}>
            <div className="stat-count" style={{ color: mqttConnected ? 'var(--success)' : 'var(--danger)' }}>
              {mqttConnected ? 'Connected' : 'Offline'}
            </div>
            <div className="stat-label">Broker</div>
          </div>
          <div className="stat-card" style={{ borderColor: wifiColor === 'green' ? 'var(--success)' : wifiColor === 'yellow' ? 'var(--warning)' : wifiColor === 'red' ? 'var(--danger)' : 'var(--border)' }}>
            <div className="stat-count" style={{ color: wifiColor === 'green' ? 'var(--success)' : wifiColor === 'yellow' ? 'var(--warning)' : wifiColor === 'red' ? 'var(--danger)' : 'var(--text-muted)' }}>
              {wifiLabel}
            </div>
            <div className="stat-label">WiFi</div>
          </div>
        </div>
      )}

      <AlertsList />

      {rooms.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🏠</div>
          <h3>No rooms yet</h3>
          <p>Create a room, then add your devices to it.</p>
          <button className="btn btn-primary" onClick={() => setShowNewRoom(true)}>+ Create Room</button>
        </div>
      ) : (
        <div className="room-grid">
          {rooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              mqttConnected={mqttConnected}
              onToggle={async () => { await api.toggleRoom(room.id); loadRooms() }}
              onDelete={() => deleteRoom(room.id)}
              onClick={() => navigate(`/rooms/${room.id}`)}
            />
          ))}
        </div>
      )}

      <div className="toolbar" style={{ marginTop: '1rem' }}>
        <button className="btn btn-primary" onClick={() => setShowNewRoom((v) => !v)}>
          {showNewRoom ? 'Close' : '+ Create Room'}
        </button>
      </div>

      {showNewRoom && (
        <div className="add-form-wrap">
          <div className="add-form">
            <div className="field">
              <label>Room Name</label>
              <input type="text" value={newName} placeholder="e.g. Living Room" onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createRoom()} />
            </div>
            <div className="field" style={{ maxWidth: '80px' }}>
              <label>Icon</label>
              <input type="text" value={newIcon} placeholder="💡" onChange={(e) => setNewIcon(e.target.value || '💡')} />
            </div>
            <div className="btn-row">
              <button className="btn btn-success" onClick={createRoom} disabled={!newName.trim()}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}