export interface Command {
  id: string
  label: string
  type: string
  actions: string[]
}

export interface Telemetry {
  device_id?: string
  mac?: string
  ip?: string
  uptime_s?: number
  rssi?: number
  free_heap?: number
  temp_cpu?: number
  led_state?: string
  mqtt_connected?: boolean
  wifi_connected?: boolean
  [key: string]: unknown
}

export interface Device {
  id: string
  name: string
  description: string
  ip: string
  mac: string | null
  deviceId: string | null
  status: 'connecting' | 'connected' | 'error'
  error: string | null
  commandMode: 'http' | 'mqtt'
  commands: Command[]
  lastTelemetry: Telemetry | null
  lastTelemetryTs: number
  createdAt: number
}

export type DeviceStatusPayload = Partial<Omit<Device, 'id' | 'commands' | 'commandMode'>> & {
  commands?: Command[]
  commandMode?: 'http' | 'mqtt'
}

export interface SseEvent {
  type: 'status' | 'telemetry' | 'remove'
  deviceId: string
  data: DeviceStatusPayload | Telemetry | undefined
}

export interface ApiInfo {
  version?: string
  backend?: string
  firmware?: string
  protocol?: string
}

export interface ApiConfig {
  mqtt_connected: boolean
}

export interface CommandResult {
  commandId: string
  action: string
  mode: 'http' | 'mqtt'
  topic?: string
  response?: unknown
}

export interface OtaResult {
  success: boolean
  status: number
  message: string
}

export interface DiscoveredDevice {
  mac: string
  name: string
  ip: string
  deviceId: string | null
}

export interface DiscoverResult {
  discovered: DiscoveredDevice[]
}