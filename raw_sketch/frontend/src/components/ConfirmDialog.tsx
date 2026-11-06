interface Props {
  open: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({ open, title, message, confirmText = 'Confirm', cancelText = 'Cancel', danger, onConfirm, onCancel }: Props) {
  if (!open) return null
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p className="muted" style={{ margin: '0.5rem 0 1rem' }}>{message}</p>
        <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onCancel}>{cancelText}</button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>
  )
}