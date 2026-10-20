import type { Section } from '../App'

interface Props {
  section: Section
  onNavigate: (section: Section) => void
  deviceCount: number
  mqttConnected: boolean
}

export default function Sidebar({ section, onNavigate, deviceCount, mqttConnected }: Props) {
  const items: { key: Section; icon: string; label: string }[] = [
    { key: 'dashboard', icon: '📊', label: 'Dashboard' },
    { key: 'ota', icon: '⬆️', label: 'OTA Update' },
    { key: 'settings', icon: '⚙️', label: 'Settings' },
  ]

  return (
    <nav className="sidebar">
      <div className="sidebar-logo" onClick={() => onNavigate('dashboard')}>
        <span>💡</span>
        <h1>LCFLIGHT</h1>
      </div>
      <div className="sidebar-nav">
        {items.map((item) => (
          <button
            key={item.key}
            className={section === item.key ? 'active' : ''}
            onClick={() => onNavigate(item.key)}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>
      <div className="sidebar-footer">
        <span className={`dot ${mqttConnected ? 'green' : 'red'}`}></span>
        <span>{mqttConnected ? 'Connected' : 'Disconnected'}</span>
        <span className="count">{deviceCount}</span>
      </div>
    </nav>
  )
}