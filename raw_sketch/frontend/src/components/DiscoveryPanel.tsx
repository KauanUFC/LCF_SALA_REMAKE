import { useState, useRef } from 'react'
import { api } from '../api/client'
import type { DiscoveredDevice } from '../types/types'
import type { useDevices as UseDevices } from '../hooks/useDevices'

type DevicesHook = ReturnType<typeof UseDevices>

type Phase = 'idle' | 'scanning' | 'results' | 'empty'

interface Props {
  hook: Pick<DevicesHook, 'addDevice'>
}

export default function DiscoveryPanel({ hook }: Props) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [found, setFound] = useState<DiscoveredDevice[]>([])
  const [adding, setAdding] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [seconds, setSeconds] = useState(10)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startScan = async () => {
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
      const res = await api.discover()
      clearInterval(interval)
      timerRef.current = null

      if (res.discovered.length > 0) {
        setFound(res.discovered)
        setPhase('results')
      } else {
        setPhase('empty')
      }
    } catch (e) {
      clearInterval(interval)
      timerRef.current = null
      setError((e as Error).message)
      setPhase('empty')
    }
  }

  const cancel = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    setPhase('idle')
    setFound([])
    setSeconds(10)
  }

  const addDiscovered = async (d: DiscoveredDevice) => {
    setAdding(d.mac)
    try {
      await hook.addDevice({ name: d.name, description: `Auto-discovered (${d.mac})`, ip: d.ip })
      setFound((prev) => prev.filter((x) => x.mac !== d.mac))
      if (found.length <= 1) setPhase('idle')
    } catch (e) {
      setError(`Failed to add ${d.mac}: ${(e as Error).message}`)
    } finally {
      setAdding(null)
    }
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
            <span>{found.length} device(s) found on MQTT</span>
          </div>
          <div className="discovery-list">
            {found.map((d) => (
              <div key={d.mac} className="discovery-item">
                <div className="discovery-info">
                  <strong>{d.name}</strong>
                  <span className="muted">{d.ip} | {d.mac}</span>
                </div>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => addDiscovered(d)}
                  disabled={adding === d.mac}
                >
                  {adding === d.mac ? 'Adding...' : 'Add'}
                </button>
              </div>
            ))}
          </div>
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