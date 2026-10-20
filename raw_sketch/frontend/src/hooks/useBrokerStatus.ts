import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { ApiInfo } from '../types/types'

export function useBrokerStatus() {
  const [mqttConnected, setMqttConnected] = useState(false)
  const [info, setInfo] = useState<ApiInfo | null>(null)

  useEffect(() => {
    let active = true
    const poll = async () => {
      try {
        const [cfg, infoRes] = await Promise.all([api.config(), api.info()])
        if (!active) return
        setMqttConnected(cfg.mqtt_connected)
        setInfo(infoRes)
      } catch {
        // ignore transient failures
      }
    }
    poll()
    const timer = setInterval(poll, 5000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [])

  return { mqttConnected, info }
}