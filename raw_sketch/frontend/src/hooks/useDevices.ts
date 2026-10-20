import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import { useSse } from './useSse'
import type { Device, DeviceStatusPayload } from '../types/types'

const TELEMETRY_STALE_MS = 20000

function mergeStatus(device: Device, data: DeviceStatusPayload): Device {
  const next: Device = { ...device }
  if (data.status) next.status = data.status
  if (data.error !== undefined) next.error = data.error
  if (data.mac) next.mac = data.mac
  if (data.deviceId) next.deviceId = data.deviceId
  if (data.commands) next.commands = data.commands
  if (data.commandMode) next.commandMode = data.commandMode
  if (data.name) next.name = data.name
  if (data.description) next.description = data.description
  if (data.ip) next.ip = data.ip
  return next
}

const defaultDevices: Device[] = []

export function useDevices() {
  const [devices, setDevices] = useState<Device[]>(defaultDevices)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .listDevices()
      .then((list) => {
        const seen = new Set<string>()
        const fresh = list.map((d) => {
          seen.add(d.id)
          return { ...d, lastTelemetry: d.lastTelemetry ?? null }
        })
        setDevices(fresh)
      })
      .catch(() => setDevices([]))
      .finally(() => setLoading(false))
  }, [])

  useSse(
    (event) => {
      setDevices((prev) => {
        switch (event.type) {
          case 'status': {
            const data = event.data as DeviceStatusPayload
            const existing = prev.find((d) => d.id === event.deviceId)
            if (existing) {
              return prev.map((d) => (d.id === event.deviceId ? mergeStatus(d, data) : d))
            }
            const device: Device = {
              id: event.deviceId,
              name: data.name || event.deviceId,
              description: data.description || '',
              ip: data.ip || '?',
              mac: data.mac || null,
              deviceId: data.deviceId || null,
              status: (data.status as Device['status']) || 'connecting',
              error: data.error || null,
              commandMode: data.commandMode || 'http',
              commands: data.commands || [{ id: 'led', label: 'LED', type: 'binary', actions: ['on', 'off'] }],
              lastTelemetry: null,
              lastTelemetryTs: 0,
              createdAt: Date.now(),
            }
            return [...prev, device]
          }
          case 'telemetry':
            return prev.map((d) =>
              d.id === event.deviceId
                ? { ...d, lastTelemetry: event.data as Device['lastTelemetry'], lastTelemetryTs: Date.now() }
                : d,
            )
          case 'remove':
            return prev.filter((d) => d.id !== event.deviceId)
          default:
            return prev
        }
      })
    },
    !loading,
  )

  const isStale = useCallback((device: Device) => {
    if (!device.lastTelemetry) return false
    return Date.now() - device.lastTelemetryTs > TELEMETRY_STALE_MS
  }, [])

  const addDevice = useCallback(async (body: { name: string; description: string; ip: string }) => {
    const device = await api.addDevice(body)
    setDevices((prev) => [...prev.filter((d) => d.id !== device.id), device])
    return device
  }, [])

  const setMode = useCallback(async (id: string, mode: 'http' | 'mqtt') => {
    const updated = await api.setMode(id, mode)
    setDevices((prev) => prev.map((d) => (d.id === id ? updated : d)))
  }, [])

  const sendCommand = useCallback(async (id: string, commandId: string, action: string) => {
    return api.command(id, commandId, action)
  }, [])

  const retryDevice = useCallback(async (id: string) => {
    return api.retry(id)
  }, [])

  const removeDevice = useCallback(async (id: string) => {
    await api.remove(id)
    setDevices((prev) => prev.filter((d) => d.id !== id))
  }, [])

  return { devices, loading, isStale, addDevice, setMode, sendCommand, retryDevice, removeDevice }
}

export { TELEMETRY_STALE_MS }