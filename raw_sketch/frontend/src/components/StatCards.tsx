interface Props {
  total: number
  online: number
  offline: number
  connecting: number
}

export default function StatCards({ total, online, offline, connecting }: Props) {
  return (
    <div className="stat-grid">
      <div className="stat-card total">
        <div className="stat-count">{total}</div>
        <div className="stat-label">Total</div>
      </div>
      <div className="stat-card online">
        <div className="stat-count">{online}</div>
        <div className="stat-label">Online</div>
      </div>
      <div className="stat-card offline">
        <div className="stat-count">{offline}</div>
        <div className="stat-label">Offline</div>
      </div>
      <div className="stat-card connecting">
        <div className="stat-count">{connecting}</div>
        <div className="stat-label">Connecting</div>
      </div>
    </div>
  )
}