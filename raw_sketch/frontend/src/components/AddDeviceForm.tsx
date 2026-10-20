import { useState } from 'react'

interface Props {
  onAdd: (data: { name: string; description: string; ip: string }) => Promise<void>
}

export default function AddDeviceForm({ onAdd }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [ip, setIp] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!name.trim() || !ip.trim()) {
      setError('Name and IP are required')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onAdd({ name: name.trim(), description: description.trim(), ip: ip.trim() })
      setName('')
      setDescription('')
      setIp('')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="add-form-wrap">
      <div className="add-form">
        <div className="field">
          <label>Name</label>
          <input type="text" value={name} placeholder="e.g. Kitchen ESP" onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>Description</label>
          <input type="text" value={description} placeholder="Optional" onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="field">
          <label>IP / mDNS</label>
          <input
            type="text"
            value={ip}
            placeholder="e.g. 192.168.1.42"
            onChange={(e) => setIp(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </div>
        <div className="btn-row">
          <button className="btn btn-success" onClick={submit} disabled={busy}>
            {busy ? 'Connecting...' : 'Connect'}
          </button>
        </div>
      </div>
      {error && <div className="form-error">{error}</div>}
    </div>
  )
}