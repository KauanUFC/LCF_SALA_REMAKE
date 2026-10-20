import { useRef, useState } from 'react'
import { api } from '../api/client'
import type { Device } from '../types/types'
import { fmtBytes } from '../lib/format'

type Status = { type: 'info' | 'success' | 'error'; text: string } | null

interface Props {
  hook: { devices: Device[] }
}

export default function OtaSection({ hook }: Props) {
  const devices = hook.devices.filter((d) => d.status === 'connected' && d.ip)
  const [deviceId, setDeviceId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [status, setStatus] = useState<Status>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = (f: File | undefined | null) => {
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.bin')) {
      setStatus({ type: 'error', text: 'Please select a .bin file' })
      return
    }
    setFile(f)
    setProgress(0)
    setStatus({ type: 'info', text: `Ready to upload ${f.name}` })
  }

  const upload = async () => {
    if (!deviceId || !file) return
    setUploading(true)
    setStatus({ type: 'info', text: 'Uploading...' })
    try {
      await api.otaUpload(deviceId, file, (pct) => setProgress(pct))
      setProgress(100)
      setStatus({ type: 'success', text: 'Update sent! ESP32 is rebooting...' })
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (e) {
      setStatus({ type: 'error', text: `Error: ${(e as Error).message}` })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="section">
      <div className="page-header">
        <h2>Firmware Update</h2>
      </div>

      <div className="card">
        <div className="card-header"><h3>Upload firmware to device</h3></div>
        <div className="card-body">
          <div className="form-group">
            <label className="form-label">Target Device</label>
            <select className="form-select" value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
              <option value="">— Select a device —</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>{d.name} ({d.ip})</option>
              ))}
            </select>
          </div>

          <div
            className="upload-box"
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('dragover') }}
            onDragLeave={(e) => e.currentTarget.classList.remove('dragover')}
            onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('dragover'); handleFile(e.dataTransfer.files?.[0]) }}
          >
            <div className="upload-icon">⚡</div>
            <p className="muted">Drag &amp; drop your firmware file here</p>
            <p className="muted small">or</p>
            <label className="file-label">
              Choose .bin file
              <input
                ref={fileInputRef}
                type="file"
                accept=".bin"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </label>
            {file && <div>{file.name} ({fmtBytes(file.size)})</div>}
          </div>

          <button className="btn btn-success block" onClick={upload} disabled={uploading || !file || !deviceId}>
            {uploading ? 'Uploading...' : 'Upload Firmware'}
          </button>

          {uploading && (
            <div className="progress-wrap">
              <div className="progress-bar-bg"><div className="progress-bar" style={{ width: `${progress}%` }} /></div>
              <div className="progress-text">{progress}%</div>
            </div>
          )}

          {status && <div className={`status-${status.type}`}>{status.text}</div>}

          <div className="ota-note">
            ⓘ During the update the ESP32 will restart automatically. Do not power off while updating.
          </div>
        </div>
      </div>
    </div>
  )
}