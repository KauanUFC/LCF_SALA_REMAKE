import { NavLink } from 'react-router-dom'

interface Props {
  deviceCount: number
  mqttConnected: boolean
}

export default function Sidebar({ deviceCount, mqttConnected }: Props) {
  const items: { to: string; icon: string; label: string; end?: boolean }[] = [
    { to: '/dashboard', icon: '📊', label: 'Dashboard', end: true },
    { to: '/rooms', icon: '🏠', label: 'Rooms' },
    { to: '/devices', icon: '📡', label: 'Devices' },
    { to: '/add-device', icon: '➕', label: 'Add Device' },
    { to: '/scenes', icon: '🎬', label: 'Scenes' },
    { to: '/schedules', icon: '⏰', label: 'Schedules' },
    { to: '/ota', icon: '⬆️', label: 'OTA Update' },
    { to: '/settings', icon: '⚙️', label: 'Settings' },
    { to: '/credits', icon: '📝', label: 'Credits' },
  ]

  return (
    <nav className="sidebar">
      <NavLink to="/dashboard" className="sidebar-logo">
        <span>💡</span>
        <h1>LCFLIGHT</h1>
      </NavLink>
      <div className="sidebar-nav">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => isActive ? 'active' : ''}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </NavLink>
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