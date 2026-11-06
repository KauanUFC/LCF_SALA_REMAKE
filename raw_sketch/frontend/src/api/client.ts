import type { ApiConfig, ApiInfo, AlertItem, AppPreferences, CommandResult, Device, DeviceConfig, DiscoveredDevice, OtaResult, Room, Scene, SceneSetting, Schedule, ScheduleInput } from '../types/types'

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const body = (await res.json()) as { error?: string }
      if (body.error) message = body.error
    } catch {
      // ignore
    }
    throw new Error(message)
  }
  return res.json() as Promise<T>
}

export const api = {
  info: () => request<ApiInfo>('/api/info'),
  config: () => request<ApiConfig>('/api/config'),

  // Rooms
  listRooms: (search?: string) =>
    request<Room[]>(`/api/rooms${search && search.trim() ? `?search=${encodeURIComponent(search.trim())}` : ''}`),
  getRoom: (id: number) => request<Room>(`/api/rooms/${id}`),
  createRoom: (body: { name: string; icon?: string }) =>
    request<Room>('/api/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  updateRoom: (id: number, body: { name?: string; icon?: string }) =>
    request<Room>(`/api/rooms/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  deleteRoom: (id: number) =>
    request<{ success: boolean }>(`/api/rooms/${id}`, { method: 'DELETE' }),
  toggleRoom: (id: number) =>
    request<{ toggled: number; target: string }>(`/api/rooms/${id}/toggle`, { method: 'POST' }),
  setRoomBrightness: (id: number, brightness: number) =>
    request<{ applicable: number; brightness: number }>(`/api/rooms/${id}/brightness`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brightness }),
    }),

  // Devices
  listDevices: (roomId?: number) =>
    request<Device[]>(`/api/devices${roomId !== undefined ? `?room_id=${roomId}` : ''}`),
  addDevice: (body: { name: string; ip: string; roomId?: number; deviceType?: string; mac?: string }) =>
    request<Device>('/api/devices', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }),
  updateDevice: (id: number, body: { name?: string; roomId?: number; deviceType?: string }) =>
    request<Device>(`/api/devices/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }),
  setMode: (id: number, commandMode: 'http' | 'mqtt') =>
    request<Device>(`/api/devices/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ commandMode }),
    }),
  retry: (id: number) => request<Device>(`/api/devices/${id}/retry`, { method: 'POST' }),
  restartDevice: (id: number) =>
    request<{ success: boolean }>(`/api/devices/${id}/restart`, { method: 'POST' }),
  remove: (id: number) => request<{ success: boolean }>(`/api/devices/${id}`, { method: 'DELETE' }),
  command: (id: number, commandId: string, action: string, value?: string | number) =>
    request<CommandResult>(`/api/devices/${id}/command`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ commandId, action, value }),
    }),

  // Discovery
  discover: (signal?: AbortSignal) =>
    request<{ discovered: DiscoveredDevice[] }>('/api/discover', { method: 'POST', signal }),

  // Schedules
  listSchedules: () => request<Schedule[]>('/api/schedules'),
  getSchedule: (id: number) => request<Schedule>(`/api/schedules/${id}`),
  createSchedule: (body: ScheduleInput) =>
    request<Schedule>('/api/schedules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  updateSchedule: (id: number, body: Partial<ScheduleInput>) =>
    request<Schedule>(`/api/schedules/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  deleteSchedule: (id: number) =>
    request<{ success: boolean }>(`/api/schedules/${id}`, { method: 'DELETE' }),
  toggleSchedule: (id: number) =>
    request<Schedule>(`/api/schedules/${id}/toggle`, { method: 'POST' }),

  // Scenes
  listScenes: () => request<Scene[]>('/api/scenes'),
  getScene: (id: number) => request<Scene>(`/api/scenes/${id}`),
  createScene: (body: Partial<Scene> | { name: string; roomId?: number | null; fromCurrent?: boolean; deviceIds?: number[] }) =>
    request<Scene>('/api/scenes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  updateScene: (id: number, body: { name?: string; roomId?: number | null; settings?: SceneSetting[] }) =>
    request<Scene>(`/api/scenes/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  deleteScene: (id: number) =>
    request<{ success: boolean }>(`/api/scenes/${id}`, { method: 'DELETE' }),
  applyScene: (id: number) =>
    request<{ status: string; applied: number }>(`/api/scenes/${id}/apply`, { method: 'POST' }),

  // Preferences
  getPreferences: () => request<AppPreferences>('/api/preferences'),
  updatePreferences: (body: Partial<AppPreferences>) =>
    request<AppPreferences>('/api/preferences', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),

  // Alerts
  listAlerts: () => request<AlertItem[]>('/api/alerts'),

  // Device config
  getDeviceConfig: (id: number) => request<DeviceConfig>(`/api/devices/${id}/config`),
  updateDeviceConfig: (id: number, body: Partial<DeviceConfig>) =>
    request<DeviceConfig>(`/api/devices/${id}/config`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),

  // OTA
  otaUpload: (id: number, file: File, onProgress?: (pct: number) => void) => {
    const form = new FormData()
    form.append('firmware', file)
    return new Promise<OtaResult>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100))
      }
      xhr.onload = () => {
        try {
          const body = JSON.parse(xhr.responseText) as OtaResult
          if (body.success) resolve(body)
          else reject(new Error(body.message || 'Update failed'))
        } catch { reject(new Error('Unexpected response')) }
      }
      xhr.onerror = () => reject(new Error('Network error'))
      xhr.open('POST', `/api/ota/upload?deviceId=${encodeURIComponent(String(id))}`, true)
      xhr.send(form)
    })
  },
}