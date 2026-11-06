import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import type { DiscoveredDevice } from '../types/types'
import type { useDevices as UseDevices } from '../hooks/useDevices'

type DevicesHook = ReturnType<typeof UseDevices>

type Phase = 'idle' | 'scanning' | 'results' | 'empty'

interface Props {
  hook: Pick<DevicesHook, 'addDevice'>
  // If provided, discovered devices are auto-assigned to this room.
  roomId?: number
}

interface PickState {
  [mac: string]: string // mac -> room id string
}

export default function DiscoveryPanel({ hook, roomId }: Props) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [found, setFound] = useState<DiscoveredDevice[]>([])
  const [rooms, setRooms] = useState<{ id: number; name: string; icon: string }[]>([])
  const [picks, setPicks] = useState<PickState>({})
  const [adding, setAdding] = useState<string | null>(null)
  const [moving, setMoving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [seconds, setSeconds] = useState(10)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const loadRooms = () => {
    api.listRooms().then((rs) => setRooms(rs.map((r) => ({ id: r.id, name: r.name, icon: r.icon })))).catch(() => setRooms([]))
  }

  const startScan = async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setPhase('scanning')
    setError(null)
    setFound([])
    setSeconds(10)

    const interval = setInterval(() => {
      setSeconds((s) => {
        if (s <= 0) return 0
        return s - 1
      })
    }, 1000)
    timerRef.current = interval

    try {
      const res = await api.discover(controller.signal)
      clearInterval(interval)
      timerRef.current = null
      abortRef.current = null

      if (res.discovered.length > 0) {
        setFound(res.discovered)
        const defaults: PickState = {}
        if (roomId !== undefined) {
          for (const d of res.discovered) defaults[d.mac] = String(roomId)
        }
        setPicks(defaults)
        setPhase('results')
      } else {
        setPhase('empty')
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      clearInterval(interval)
      timerRef.current = null
      abortRef.current = null
      setError((e as Error).message)
      setPhase('empty')
    }
  }

  // Auto-start scanning as soon as the panel opens.
  useEffect(() => {
    startScan()
    if (roomId === undefined) loadRooms()
    return () => {
      abortRef.current?.abort()
      abortRef.current = null
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cancel = () => {
    abortRef.current?.abort()
    abortRef.current = null
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    setPhase('idle')
    setFound([])
    setSeconds(10)
  }

  const addDiscovered = async (d: DiscoveredDevice) => {
    setError(null)
    const targetRoom = picks[d.mac]
    if (roomId === undefined && (!targetRoom || targetRoom === '')) {
      setError(`Please select a room for "${d.name}"`)
      return
    }
    setAdding(d.mac)
    try {
      await hook.addDevice({
        name: d.name,
        ip: d.ip,
        mac: d.mac,
        roomId: targetRoom ? Number(targetRoom) : roomId,
      })
      setFound((prev) => prev.filter((x) => x.mac !== d.mac))
      if (found.length <= 1) setPhase('idle')
    } catch (e) {
      setError(`Failed to add ${d.mac}: ${(e as Error).message}`)
    } finally {
      setAdding(null)
    }
  }

  const moveDiscovered = async (d: DiscoveredDevice) => {
    setError(null)
    const targetRoom = picks[d.mac]
    if (!targetRoom || targetRoom === '') {
      setError(`Please select a room to move "${d.name}"`)
      return
    }
    setMoving(d.mac)
    try {
      // already-discovered device: find its id by MAC, then move it.
      const dev = await api.listDevices().then((ds) => ds.find((x) => x.mac === d.mac))
      if (!dev) throw new Error('Device not found in registry')
      await api.updateDevice(dev.id, { roomId: Number(targetRoom) })
      setFound((prev) => prev.filter((x) => x.mac !== d.mac))
      if (found.length <= 1) setPhase('idle')
      else setPicks((prev) => { const n = { ...prev }; delete n[d.mac]; return n })
    } catch (e) {
      setError(`Failed to move ${d.mac}: ${(e as Error).message}`)
    } finally {
      setMoving(null)
    }
  }

  const roomSelect = (mac: string, value: string) => {
    setPicks((prev) => ({ ...prev, [mac]: value }))
  }

  if (phase === 'idle') return null

  return (
    <div className="discovery-panel">
      {phase === 'scanning' && (
        <>
          <div className="discovery-header">
            <span className="spinner" />
            <span>Searching for devices... ({seconds}s)</span>
          </div>
          <div className="progress-bar-bg">
            <div className="progress-bar" style={{ width: `${(1 - seconds / 10) * 100}%` }} />
          </div>
          <button className="btn btn-sm btn-ghost discovery-cancel" onClick={cancel}>
            Cancel
          </button>
        </>
      )}

      {phase === 'results' && (
        <>
          <div className="discovery-header success">
            <span>{found.length} device(s) on the network</span>
          </div>
          <div className="discovery-list">
            {found.map((d) => (
              <div key={d.mac} className="discovery-item">
                <div className="discovery-info">
                  <strong>{d.name}</strong>
                  <span className="muted">{d.ip} | {d.mac}</span>
                </div>
                {roomId === undefined && (
                  <select
                    className="form-select"
                    style={{ width: 'auto', minWidth: '130px' }}
                    value={picks[d.mac] || ''}
                    onChange={(e) => roomSelect(d.mac, e.target.value)}
                  >
                    <option value="">— Select a room —</option>
                    {rooms.map((r) => <option key={r.id} value={r.id}>{r.icon} {r.name}</option>)}
                  </select>
                )}
                {d.alreadyAdded ? (
                  roomId === undefined ? (
                    <button className="btn btn-sm btn-ghost" onClick={() => moveDiscovered(d)} disabled={moving === d.mac || adding === d.mac}>
                      {moving === d.mac ? 'Moving...' : 'Move'}
                    </button>
                  ) : (
                    <span className="badge badge-awaiting">Already added</span>
                  )
                ) : (
                  <button className="btn btn-sm btn-primary" onClick={() => addDiscovered(d)} disabled={adding === d.mac || (roomId === undefined && (!picks[d.mac] || picks[d.mac] === ''))}>
                    {adding === d.mac ? 'Adding...' : 'Add'}
                  </button>
                )}
              </div>
            ))}
          </div>

          {error && <div className="form-error" style={{ marginBottom: '0.5rem' }}>{error}</div>}

          <button className="btn btn-sm btn-ghost" onClick={() => setPhase('idle')}>
            Done
          </button>
        </>
      )}

      {phase === 'empty' && (
        <>
          <div className="discovery-header error">{error || 'No devices discovered in 10s'}</div>
          <div className="discovery-actions">
            <button className="btn btn-sm btn-primary" onClick={startScan}>
              Try Again
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => setPhase('idle')}>
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  )
}