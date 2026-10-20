import { useState } from 'react'
import { useDevices } from './hooks/useDevices'
import { useBrokerStatus } from './hooks/useBrokerStatus'
import Sidebar from './components/Sidebar'
import DashboardSection from './components/DashboardSection'
import OtaSection from './components/OtaSection'
import SettingsSection from './components/SettingsSection'

export type Section = 'dashboard' | 'ota' | 'settings'

export default function App() {
  const [section, setSection] = useState<Section>('dashboard')
  const { mqttConnected, info } = useBrokerStatus()
  const devices = useDevices()

  const switchSection = (name: Section) => setSection(name)

  return (
    <div className="app">
      <Sidebar section={section} onNavigate={switchSection} deviceCount={devices.devices.length} mqttConnected={mqttConnected} />
      <main className="main-content">
        {section === 'dashboard' && <DashboardSection hook={devices} onNavigate={switchSection} />}
        {section === 'ota' && <OtaSection hook={devices} />}
        {section === 'settings' && <SettingsSection mqttConnected={mqttConnected} info={info} />}
      </main>
    </div>
  )
}