import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { AlertItem } from '../types/types'

export default function AlertsList() {
  const [alerts, setAlerts] = useState<AlertItem[]>([])

  const load = () => {
    api.listAlerts().then(setAlerts).catch(() => setAlerts([]))
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
  }, [])

  if (alerts.length === 0) return null

  return (
    <div className="alerts-list card" style={{ marginBottom: '1rem' }}>
      <div className="card-header"><h3>⚠️ Alerts</h3></div>
      <div className="card-body">
        {alerts.map((a) => (
          <div key={a.id} className={`alert-item alert-${a.type}`}>
            <div className="alert-title">{a.title}</div>
            <div className="alert-message">{a.message}</div>
          </div>
        ))}
      </div>
    </div>
  )
}