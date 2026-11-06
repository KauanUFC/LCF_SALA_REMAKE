export default function Credits() {
  const libraries = [
    'React', 'React Router', 'Vite', 'TypeScript',
    'Express', 'better-sqlite3', 'MQTT.js', 'Multer',
  ]

  return (
    <div className="section">
      <div className="page-header"><h2>Credits</h2></div>

      <div className="card settings-card">
        <div className="card-header"><h3>Contributors</h3></div>
        <div className="card-body">
          <p>LCFLIGHT — ESP32 light management dashboard.</p>
          <p className="muted" style={{ marginTop: '0.5rem' }}>Built for the Laboratório de Computação Física (LCF), UFC.</p>
        </div>
      </div>

      <div className="card settings-card">
        <div className="card-header"><h3>Open Source Libraries</h3></div>
        <div className="card-body">
          <ul className="credits-list">
            {libraries.map((lib) => <li key={lib}>{lib}</li>)}
          </ul>
        </div>
      </div>
    </div>
  )
}