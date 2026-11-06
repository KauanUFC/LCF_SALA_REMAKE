import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import { useSse } from './useSse'
import type { Device, DeviceStatusPayload, Telemetry } from '../types/types'

const TELEMETRY_STALE_MS = 20000

function applyDevicePatch(device: Device, data: DeviceStatusPayload): Device {
  return {
    ...device,
    ...(data.name !== undefined && { name: data.name }),
    ...(data.mac !== undefined && { mac: data.mac }),
    ...(data.deviceId !== undefined && { deviceId: data.deviceId }),
    ...(data.deviceType !== undefined && { deviceType: data.deviceType as Device['deviceType'] }),
    ...(data.ip !== undefined && { ip: data.ip }),
    ...(data.status !== undefined && { status: data.status as Device['status'] }),
    ...(data.error !== undefined && { error: data.error }),
    ...(data.commandMode !== undefined && { commandMode: data.commandMode }),
    ...(data.commands !== undefined && { commands: data.commands }),
    ...(data.roomId !== undefined && { roomId: data.roomId }),
  }
}

export function useDevices() {
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.listDevices()
      .then((list) => setDevices(list.map((d) => ({ ...d, lastTelemetry: d.lastTelemetry ?? null }))))
      .catch(() => setDevices([]))
      .finally(() => setLoading(false))
  }, [])

  useSse(
    (event) => {
      setDevices((prev) => {
        switch (event.type) {
          case 'status': {
            const data = event.data as DeviceStatusPayload
            const existing = prev.find((d) => String(d.id) === event.deviceId)
            if (existing) {
              return prev.map((d) => (String(d.id) === event.deviceId ? applyDevicePatch(d, data) : d))
            }
            const device: Device = {
              id: data.id,
              roomId: data.roomId ?? null,
              name: data.name || event.deviceId,
              mac: data.mac || null,
              deviceId: data.deviceId || null,
              deviceType: (data.deviceType as Device['deviceType']) || 'relay',
              connectionMethod: 'http',
              ip: data.ip || null,
              mqttTopic: null,
              status: (data.status as Device['status']) || 'connecting',
              error: data.error || null,
              commandMode: data.commandMode || 'http',
              commands: data.commands || [{ id: 'led', label: 'LED', type: 'binary', actions: ['on', 'off'] }],
              lastTelemetry: null,
              lastTelemetryTs: 0,
              createdAt: data.createdAt || Date.now(),
              updatedAt: Date.now(),
            }
            return [...prev, device]
          }
          case 'telemetry':
            return prev.map((d) =>
              String(d.id) === event.deviceId
                ? { ...d, lastTelemetry: event.data as Telemetry, lastTelemetryTs: Date.now() }
                : d,
            )
          case 'remove':
            return prev.filter((d) => String(d.id) !== event.deviceId)
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

  // Online == receiving fresh telemetry. This is the live signal for whether the
// device is reachable; the HTTP-probe `status` column only reflects the last
// probe result and stays "connected" after a device drops offline, so it must
// not drive the online state.
  const isOnline = useCallback((device: Device) => {
    return !!(device.lastTelemetry && !isStale(device))
  }, [isStale])

  const addDevice = useCallback(async (body: { name: string; ip: string; roomId?: number; deviceType?: string; mac?: string }) => {
    return api.addDevice(body)
  }, [])

  const setMode = useCallback(async (id: number, mode: 'http' | 'mqtt') => {
    const updated = await api.setMode(id, mode)
    setDevices((prev) => prev.map((d) => (d.id === id ? updated : d)))
  }, [])

  const sendCommand = useCallback(async (id: number, commandId: string, action: string, value?: string | number) => {
    return api.command(id, commandId, action, value)
  }, [])

  const retryDevice = useCallback(async (id: number) => {
    const updated = await api.retry(id)
    setDevices((prev) => prev.map((d) => (d.id === id ? updated : d)))
    return updated
  }, [])

  const removeDevice = useCallback(async (id: number) => {
    await api.remove(id)
    setDevices((prev) => prev.filter((d) => d.id !== id))
  }, [])

  const refresh = useCallback(async () => {
    const list = await api.listDevices()
    setDevices(list.map((d) => ({ ...d, lastTelemetry: d.lastTelemetry ?? null })))
  }, [])

  return { devices, loading, isStale, isOnline, addDevice, setMode, sendCommand, retryDevice, removeDevice, refresh, setDevices }
}