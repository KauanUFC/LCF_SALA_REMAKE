import type { ApiConfig, ApiInfo, CommandResult, Device, DiscoveredDevice, OtaResult } from '../types/types'

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
  listDevices: () => request<Device[]>('/api/devices'),
  addDevice: (body: { name: string; description: string; ip: string }) =>
    request<Device>('/api/devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  discover: () =>
    request<{ discovered: DiscoveredDevice[] }>('/api/discover', { method: 'POST' }),
  setMode: (id: string, commandMode: 'http' | 'mqtt') =>
    request<Device>(`/api/devices/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commandMode }),
    }),
  retry: (id: string) => request<Device>(`/api/devices/${id}/retry`, { method: 'POST' }),
  remove: (id: string) =>
    request<{ success: boolean }>(`/api/devices/${id}`, { method: 'DELETE' }),
  command: (id: string, commandId: string, action: string) =>
    request<CommandResult>(`/api/devices/${id}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commandId, action }),
    }),
  otaUpload: (id: string, file: File, onProgress?: (pct: number) => void) => {
    const form = new FormData()
    form.append('firmware', file)
    return new Promise<OtaResult>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100))
        }
      }
      xhr.onload = () => {
        let body: OtaResult
        try {
          body = JSON.parse(xhr.responseText) as OtaResult
        } catch {
          reject(new Error('Unexpected response'))
          return
        }
        if (body.success) resolve(body)
        else reject(new Error(body.message || 'Update failed'))
      }
      xhr.onerror = () => reject(new Error('Network error'))
      xhr.open('POST', `/api/ota/upload?deviceId=${encodeURIComponent(id)}`, true)
      xhr.send(form)
    })
  },
}