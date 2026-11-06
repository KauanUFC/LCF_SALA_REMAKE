import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useDevices } from './hooks/useDevices'
import { useBrokerStatus } from './hooks/useBrokerStatus'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import Devices from './components/Devices'
import DeviceDetail from './components/DeviceDetail'
import AddDeviceWizard from './components/AddDeviceWizard'
import Rooms from './components/Rooms'
import RoomDetail from './components/RoomDetail'
import Scenes from './components/Scenes'
import SceneEditor from './components/SceneEditor'
import SchedulesSection from './components/SchedulesSection'
import ScheduleEditor from './components/ScheduleEditor'
import SettingsSection from './components/SettingsSection'
import Credits from './components/Credits'
import OtaSection from './components/OtaSection'

export default function App() {
  const devices = useDevices()
  const { mqttConnected } = useBrokerStatus()

  return (
    <BrowserRouter>
      <div className="app">
        <Sidebar deviceCount={devices.devices.length} mqttConnected={mqttConnected} />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard hook={devices} />} />
            <Route path="/dashboard" element={<Dashboard hook={devices} />} />
            <Route path="/devices" element={<Devices hook={devices} />} />
            <Route path="/devices/:id" element={<DeviceDetail hook={devices} />} />
            <Route path="/add-device" element={<AddDeviceWizard />} />
            <Route path="/rooms" element={<Rooms />} />
            <Route path="/rooms/:id" element={<RoomDetail hook={devices} />} />
            <Route path="/scenes" element={<Scenes />} />
            <Route path="/scenes/new" element={<SceneEditor />} />
            <Route path="/scenes/:id" element={<SceneEditor />} />
            <Route path="/schedules" element={<SchedulesSection />} />
            <Route path="/schedules/new" element={<ScheduleEditor />} />
            <Route path="/schedules/:id/edit" element={<ScheduleEditor />} />
            <Route path="/ota" element={<OtaSection hook={devices} />} />
            <Route path="/settings" element={<SettingsSection />} />
            <Route path="/credits" element={<Credits />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}