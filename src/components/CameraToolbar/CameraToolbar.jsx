import './CameraToolbarStyle.css'

export const CAMERA_PRESETS = {
  free:      { position: [9, 9, 13],    target: [0, 0, 0], label: 'Free',      icon: '🔭' },
  iso:       { position: [10, 10, 10],  target: [0, 0, 0], label: 'Isometric', icon: '⬡' },
  front:     { position: [0, 5, 18],    target: [0, 2, 0], label: 'Front',     icon: '⬜' },
  top:       { position: [0, 22, 0.01], target: [0, 0, 0], label: 'Top',       icon: '⬛' },
  side:      { position: [18, 5, 0],    target: [0, 2, 0], label: 'Side',      icon: '▭' },
  back:      { position: [0, 5, -18],   target: [0, 2, 0], label: 'Back',      icon: '◫' },
}

const ANGLE_BTNS = ['iso', 'front', 'top', 'side', 'back']

export default function CameraToolbar({ cameraMode, setCameraMode, orbitEnabled, setOrbitEnabled }) {
  return (
    <div className="ctb-root">

      {/* Free move */}
      <span className="ctb-label">Camera</span>
      <button
        className={`ctb-btn ${cameraMode === 'free' ? 'active' : ''}`}
        onClick={() => setCameraMode('free')}
      >
        <span className="ctb-btn-icon">🔭</span>
        <span className="ctb-btn-label">Free</span>
      </button>

      <div className="ctb-divider" />
      <span className="ctb-label">Angle</span>

      {/* Preset angles */}
      {ANGLE_BTNS.map(key => {
        const p = CAMERA_PRESETS[key]
        return (
          <button
            key={key}
            className={`ctb-btn ${cameraMode === key ? 'active' : ''}`}
            onClick={() => setCameraMode(key)}
          >
            <span className="ctb-btn-icon">{p.icon}</span>
            <span className="ctb-btn-label">{p.label}</span>
          </button>
        )
      })}

      <div className="ctb-divider" />
      <span className="ctb-label">Mouse</span>

      {/* Orbit toggle */}
      <button
        className={`ctb-toggle ${orbitEnabled ? 'on' : ''}`}
        onClick={() => setOrbitEnabled(p => !p)}
      >
        <div className="ctb-toggle-dot">
          <div className="ctb-toggle-knob" />
        </div>
        <span className="ctb-toggle-text">{orbitEnabled ? 'Orbit ON' : 'Orbit OFF'}</span>
      </button>

    </div>
  )
}
