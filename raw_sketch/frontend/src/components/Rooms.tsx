import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { Device, Room } from '../types/types'

export default function Rooms() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [search, setSearch] = useState('')

  // create form
  const [showNew, setShowNew] = useState(false)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('💡')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // edit form
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editIcon, setEditIcon] = useState('💡')
  const [savingEdit, setSavingEdit] = useState(false)

  // misc
  const [expanded, setExpanded] = useState<number | null>(null)
  const [moving, setMoving] = useState<{ deviceId: number; to: string } | null>(null)

  const load = async (term = search) => {
    try {
      const [rs, ds] = await Promise.all([api.listRooms(term), api.listDevices()])
      setRooms(rs); setDevices(ds)
    } catch { /* ignore */ }
  }

  // Initial load + debounced SQL search whenever the term changes.
  useEffect(() => {
    const t = setTimeout(() => { load(search) }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const create = async () => {
    if (creating) return
    if (!name.trim()) { setError('Name is required'); return }
    setCreating(true); setError(null)
    try {
      await api.createRoom({ name: name.trim(), icon })
      setName(''); setIcon('💡'); setShowNew(false)
      await load(search)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCreating(false)
    }
  }

  const startEdit = (room: Room) => {
    setEditingId(room.id); setEditName(room.name); setEditIcon(room.icon); setError(null)
  }

  const saveEdit = async (id: number) => {
    if (savingEdit) return
    if (!editName.trim()) { setError('Name cannot be empty'); return }
    setSavingEdit(true); setError(null)
    try {
      await api.updateRoom(id, { name: editName.trim(), icon: editIcon || '💡' })
      setEditingId(null)
      await load(search)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSavingEdit(false)
    }
  }

  const remove = async (room: Room) => {
    if (!confirm(`Delete room "${room.name}"? Devices will become unassigned.`)) return
    try {
      await api.deleteRoom(room.id)
      await load(search)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const moveDevice = async () => {
    if (!moving) return
    const targetId = Number(moving.to)
    if (Number.isNaN(targetId)) { setMoving(null); return }
    try {
      await api.updateDevice(moving.deviceId, { roomId: targetId })
      setMoving(null)
      await load(search)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const unassigned = devices.filter((d) => d.roomId == null)

  return (
    <div className="section">
      <div className="page-header">
        <h2>Rooms</h2>
        <div className="header-actions">
          <input
            className="form-input search-input"
            placeholder="Search rooms..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="btn btn-primary" onClick={() => { setShowNew((v) => !v); setError(null) }}>
            {showNew ? 'Close' : '+ Add Room'}
          </button>
        </div>
      </div>

      {error && <div className="form-error" style={{ marginBottom: '0.75rem' }}>{error}</div>}

      {showNew && (
        <div className="add-form-wrap">
          <div className="add-form">
            <div className="field">
              <label>Name</label>
              <input value={name} placeholder="e.g. Living Room" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} />
            </div>
            <div className="field" style={{ maxWidth: '80px' }}>
              <label>Icon</label>
              <input value={icon} onChange={(e) => setIcon(e.target.value || '💡')} />
            </div>
            <div className="btn-row">
              <button className="btn btn-success" onClick={create} disabled={creating || !name.trim()}>
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {rooms.length === 0 && !showNew && (
        <div className="empty-state">
          <div className="empty-icon">🏠</div>
          <h3>{search ? 'No matching rooms' : 'No rooms'}</h3>
          <p>{search ? `No room matches "${search}".` : 'Create a room to organize your devices.'}</p>
        </div>
      )}

      <div className="rooms-list">
        {rooms.map((room) => {
          const roomDevices = devices.filter((d) => d.roomId === room.id)
          const isOpen = expanded === room.id
          const isEditing = editingId === room.id
          return (
            <div key={room.id} className="card room-row">
              <div className="room-row-header">
                {isEditing ? (
                  <div className="add-form" style={{ flex: 1 }}>
                    <div className="field"><label>Name</label><input value={editName} autoFocus onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveEdit(room.id)} /></div>
                    <div className="field" style={{ maxWidth: '80px' }}><label>Icon</label><input value={editIcon} onChange={(e) => setEditIcon(e.target.value || '💡')} /></div>
                    <div className="btn-row">
                      <button className="btn btn-sm btn-success" onClick={() => saveEdit(room.id)} disabled={savingEdit}>{savingEdit ? 'Saving...' : 'Save'}</button>
                      <button className="btn btn-sm btn-ghost" onClick={() => setEditingId(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button className="room-row-main" onClick={() => setExpanded(isOpen ? null : room.id)}>
                      <span className="room-icon">{room.icon}</span>
                      <span className="room-name">{room.name}</span>
                      <span className="muted">&nbsp;· {roomDevices.length} device(s)</span>
                    </button>
                    <div className="row-actions">
                      <Link to={`/rooms/${room.id}`} className={`btn btn-sm ${roomDevices.length === 0 ? 'btn-primary' : 'btn-ghost'}`}>
                        {roomDevices.length === 0 ? '+ Add device' : 'Open'}
                      </Link>
                      <button className="btn btn-sm btn-ghost" onClick={() => startEdit(room)}>Edit</button>
                      <button className="btn btn-sm btn-danger-ghost" onClick={() => remove(room)}>✕</button>
                    </div>
                  </>
                )}
              </div>
              {isOpen && !isEditing && (
                <div className="room-row-body">
                  {roomDevices.length === 0 ? <p className="muted">No devices in this room.</p> : (
                    <ul className="room-device-list">
                      {roomDevices.map((d) => (
                        <li key={d.id}>
                          <span>💡 {d.name} <span className="muted">({d.deviceType})</span></span>
                          <div className="row-actions">
                            {moving?.deviceId === d.id ? (
                              <>
                                <select className="form-select" value={moving.to} onChange={(e) => setMoving({ ...moving, to: e.target.value })}>
                                  {rooms.filter((r) => r.id !== room.id).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                                </select>
                                <button className="btn btn-sm btn-success" onClick={moveDevice}>Move</button>
                                <button className="btn btn-sm btn-ghost" onClick={() => setMoving(null)}>Cancel</button>
                              </>
                            ) : (
                              <>
                                <Link to={`/devices/${d.id}`} className="btn btn-sm btn-ghost">Details</Link>
                                <button className="btn btn-sm btn-ghost" onClick={() => setMoving({ deviceId: d.id, to: String(rooms.find((r) => r.id !== room.id)?.id ?? '') })}>Move</button>
                              </>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {unassigned.length > 0 && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header"><h3>Unassigned devices</h3></div>
          <div className="card-body">
            <ul className="room-device-list">
              {unassigned.map((d) => (
                <li key={d.id}>
                  <span>💡 {d.name} <span className="muted">({d.deviceType})</span></span>
                  <div className="row-actions">
                    <Link to={`/devices/${d.id}`} className="btn btn-sm btn-ghost">Details</Link>
                    {moving?.deviceId === d.id ? (
                      <>
                        <select className="form-select" value={moving.to} onChange={(e) => setMoving({ ...moving, to: e.target.value })}>
                          {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                        <button className="btn btn-sm btn-success" onClick={moveDevice}>Move</button>
                        <button className="btn btn-sm btn-ghost" onClick={() => setMoving(null)}>Cancel</button>
                      </>
                    ) : (
                      <button className="btn btn-sm btn-ghost" onClick={() => setMoving({ deviceId: d.id, to: String(rooms[0]?.id ?? '') })}>Assign to room</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}