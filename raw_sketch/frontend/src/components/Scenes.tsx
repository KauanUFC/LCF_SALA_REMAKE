import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { Room, Scene } from '../types/types'

export default function Scenes() {
  const [scenes, setScenes] = useState<Scene[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [showNew, setShowNew] = useState(false)
  const [name, setName] = useState('')
  const [roomId, setRoomId] = useState<number | ''>('')
  const [snapshot, setSnapshot] = useState(true)
  const navigate = useNavigate()

  const load = async () => {
    try {
      const [sc, rs] = await Promise.all([api.listScenes(), api.listRooms()])
      setScenes(sc); setRooms(rs)
    } catch { /* ignore */ }
  }

  useEffect(() => { load() }, [])

  const create = async () => {
    if (!name.trim()) return
    const body = snapshot
      ? { name: name.trim(), roomId: roomId === '' ? null : Number(roomId), fromCurrent: true }
      : { name: name.trim(), roomId: roomId === '' ? null : Number(roomId), settings: [] }
    try {
      await api.createScene(body)
      setName(''); setShowNew(false); load()
      navigate('/scenes')
    } catch (e) { alert((e as Error).message) }
  }

  const apply = async (s: Scene) => {
    try {
      const res = await api.applyScene(s.id)
      alert(`Scene "${s.name}" applied (${res.applied} device(s)).`)
    } catch (e) { alert((e as Error).message) }
  }

  const remove = async (s: Scene) => {
    if (!confirm(`Delete scene "${s.name}"?`)) return
    await api.deleteScene(s.id)
    load()
  }

  return (
    <div className="section">
      <div className="page-header">
        <h2>Scenes</h2>
        <button className="btn btn-primary" onClick={() => setShowNew((v) => !v)}>{showNew ? 'Close' : '+ New Scene'}</button>
      </div>

      {showNew && (
        <div className="add-form-wrap">
          <div className="add-form">
            <div className="field"><label>Scene Name</label><input value={name} placeholder="e.g. Movie Night" onChange={(e) => setName(e.target.value)} /></div>
            <div className="field">
              <label>Room</label>
              <select className="form-select" value={String(roomId)} onChange={(e) => setRoomId(Number(e.target.value) || '')}>
                <option value="">— All devices —</option>
                {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Capture</label>
              <div className="mode-group">
                <label><input type="checkbox" checked={snapshot} onChange={(e) => setSnapshot(e.target.checked)} /> Snapshot current states</label>
              </div>
            </div>
            <div className="btn-row"><button className="btn btn-success" onClick={create} disabled={!name.trim()}>Create</button></div>
          </div>
        </div>
      )}

      {scenes.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">🎬</div>
          <h3>No scenes yet</h3>
          <p>Capture the current state of a room, or create a custom lighting combination.</p>
        </div>
      )}

      <div className="scene-grid">
        {scenes.map((s) => (
          <div key={s.id} className="card scene-card">
            <div className="card-header">
              <h3>{s.name}</h3>
            </div>
            <div className="card-body">
              <p className="muted">{s.settings.length} device setting(s) · {s.roomId != null ? `Room #${s.roomId}` : 'All devices'}</p>
            </div>
            <div className="card-footer">
              <button className="btn btn-sm btn-primary" onClick={() => apply(s)}>🎬 Apply</button>
              <Link to={`/scenes/${s.id}`} className="btn btn-sm btn-ghost">Edit</Link>
              <button className="btn btn-sm btn-danger-ghost" onClick={() => remove(s)}>✕</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}