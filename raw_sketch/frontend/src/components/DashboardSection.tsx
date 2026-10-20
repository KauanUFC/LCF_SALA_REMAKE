import { useState } from 'react'
import type { Section } from '../App'
import type { useDevices as UseDevices } from '../hooks/useDevices'
import StatCards from './StatCards'
import DeviceGrid from './DeviceGrid'
import AddDeviceForm from './AddDeviceForm'
import DiscoveryPanel from './DiscoveryPanel'

type DevicesHook = ReturnType<typeof UseDevices>

interface Props {
  hook: DevicesHook
  onNavigate: (section: Section) => void
}

export default function DashboardSection({ hook, onNavigate }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [discovering, setDiscovering] = useState(false)
  const { devices, isStale } = hook

  const stats = devices.reduce(
    (acc, d) => {
      if (d.status === 'connecting') acc.connecting++
      else if (d.status === 'error' || isStale(d)) acc.offline++
      else if (d.status === 'connected') acc.online++
      return acc
    },
    { online: 0, offline: 0, connecting: 0 },
  )

  return (
    <div className="section">
      <div className="page-header">
        <h2>Dashboard</h2>
        <span className="muted">{devices.length} devices</span>
      </div>

      <StatCards total={devices.length} {...stats} />

      <div className="toolbar">
        <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Close' : '+ Add ESP32'}
        </button>
        <button className="btn btn-ghost" onClick={() => setDiscovering((v) => !v)}>
          {discovering ? 'Close Discovery' : '🔍 Discover Devices'}
        </button>
      </div>

      {showForm && (
        <AddDeviceForm onAdd={async (data) => {
          await hook.addDevice(data)
          setShowForm(false)
        }} />
      )}

      {discovering && <DiscoveryPanel hook={{ addDevice: hook.addDevice }} />}

      <DeviceGrid devices={devices} hook={hook} onNavigate={onNavigate} />
    </div>
  )
}