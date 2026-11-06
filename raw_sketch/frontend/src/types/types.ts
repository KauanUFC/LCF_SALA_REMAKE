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
  id: number
  roomId: number | null
  name: string
  mac: string | null
  deviceId: string | null
  deviceType: 'relay' | 'dimmable' | 'rgb' | 'strip'
  connectionMethod: string
  ip: string | null
  mqttTopic: string | null
  status: 'connecting' | 'connected' | 'error'
  error: string | null
  commandMode: 'http' | 'mqtt'
  commands: Command[]
  lastTelemetry: Telemetry | null
  lastTelemetryTs: number
  createdAt: number
  updatedAt: number
}

export interface DeviceStatusPayload {
  id: number
  roomId?: number | null
  name?: string
  mac?: string | null
  deviceId?: string | null
  deviceType?: string
  ip?: string | null
  status?: string
  error?: string | null
  commandMode?: 'http' | 'mqtt'
  commands?: Command[]
  createdAt?: number
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
  alreadyAdded?: boolean
}

export interface DiscoverResult {
  discovered: DiscoveredDevice[]
}

export interface RoomAggregate {
  total: number
  online: number
  offline: number
  busy: number
  allOn: boolean
  allOff: boolean
  mixed: boolean
}

export interface Room {
  id: number
  name: string
  icon: string
  sortOrder: number
  createdAt: number
  updatedAt: number
  devices: Device[]
  aggregate: RoomAggregate
}

export interface Schedule {
  id: number
  name: string
  roomId: number | null
  action: 'power' | 'brightness'
  triggerTime: string
  scope: 'room' | 'devices'
  repeatDays: string | null
  state: 'on' | 'off' | null
  brightness: number | null
  enabled: boolean
  lastRun: number | null
  lastRunStatus: string | null
  createdAt: number
  updatedAt: number
  deviceIds: number[]
}

export interface ScheduleInput {
  name: string
  roomId?: number | null
  action: 'power' | 'brightness'
  triggerTime: string
  scope: 'room' | 'devices'
  repeatDays?: string | null
  state?: 'on' | 'off' | null
  brightness?: number | null
  enabled?: boolean
  deviceIds?: number[]
}
export interface SceneSetting {
  id?: number
  sceneId?: number
  deviceId: number
  power: boolean
  brightness?: number | null
  colorHex?: string | null
  colorTemp?: number | null
}

export interface Scene {
  id: number
  name: string
  roomId: number | null
  sortOrder: number
  createdAt: number
  updatedAt: number
  settings: SceneSetting[]
}

export interface AppPreferences {
  theme: string
  brightnessUnit: string
  defaultView: string
  notifyOffline: boolean
  offlineThresholdMinutes: number
  notifyUpdates: boolean
  notifyFailures: boolean
}

export interface DeviceConfig {
  deviceId: number
  pwmFrequency: number | null
  pwmChannel: number | null
  ledCount: number | null
  colorTempMin: number | null
  colorTempMax: number | null
  supportsBrightness: boolean
  supportsColor: boolean
  supportsEffects: boolean
}

export interface AlertItem {
  id: string
  type: 'error' | 'warning' | 'info'
  deviceId: number
  title: string
  message: string
  timestamp: number
}
