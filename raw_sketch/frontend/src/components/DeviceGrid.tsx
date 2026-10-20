import type { Section } from '../App'
import { useDevices } from '../hooks/useDevices'
import DeviceCard from './DeviceCard'
import type { Device } from '../types/types'

type DevicesHook = ReturnType<typeof useDevices>

interface Props {
  devices: Device[]
  hook: DevicesHook
  onNavigate: (section: Section) => void
}

export default function DeviceGrid({ devices, hook, onNavigate }: Props) {
  if (devices.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📡</div>
        <h3>No devices connected</h3>
        <p>Click "+ Add ESP32" to get started.</p>
        <button className="btn btn-primary" onClick={() => document.querySelector<HTMLInputElement>('[placeholder*="Name"]')?.focus()}>
          Add ESP32
        </button>
      </div>
    )
  }

  return (
    <div className="device-grid">
      {devices.map((d) => (
        <DeviceCard key={d.id} device={d} hook={hook} onNavigate={onNavigate} />
      ))}
    </div>
  )
}