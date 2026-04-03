import { useNavigate } from 'react-router-dom'
import './ControlPanelStyle.css'

const ROTATIONS = [
  { label: '+X 90°', axis: 'x', dir:  1 },
  { label: '-X 90°', axis: 'x', dir: -1 },
  { label: '+Y 90°', axis: 'y', dir:  1 },
  { label: '-Y 90°', axis: 'y', dir: -1 },
  { label: '+Z 90°', axis: 'z', dir:  1 },
  { label: '-Z 90°', axis: 'z', dir: -1 },
]

export default function ControlPanel({
  boxDims,    setBoxDims,
  palletDims, setPalletDims,
  onAddBox,   onClearAll,
  selectedId, onRotate,
  boxCount,   utilPct, heightWarning,
}) {
  const navigate = useNavigate()

  return (
    <div className="cp-root">

      {/* Header */}
      <div className="cp-header">
        <div className="cp-logo">PalletPro</div>
        <button className="cp-back" onClick={() => navigate('/')}>← Back</button>
      </div>

      {/* Box Dimensions */}
      <div className="cp-section">
        <div className="cp-stitle">Box Dimensions (cm)</div>
        {['length', 'width', 'height'].map(d => (
          <div className="cp-field" key={d}>
            <label>{d.charAt(0).toUpperCase() + d.slice(1)}</label>
            <input
              type="number" min="1" max="300"
              value={boxDims[d]}
              onChange={e =>
                setBoxDims(prev => ({ ...prev, [d]: Math.max(1, Number(e.target.value)) }))
              }
            />
          </div>
        ))}
        <button className="cp-btn-add" onClick={onAddBox}>＋ Add Box</button>
        <button className="cp-btn-clear" disabled={boxCount === 0} onClick={onClearAll}>
          ✕ Clear All
        </button>
      </div>

      {/* Pallet Dimensions */}
      <div className="cp-section">
        <div className="cp-stitle">Pallet Dimensions (cm)</div>
        {['length', 'width', 'height'].map(d => (
          <div className="cp-field" key={d}>
            <label>{d === 'height' ? 'Max Height' : d.charAt(0).toUpperCase() + d.slice(1)}</label>
            <input
              type="number" min="1" max="600"
              value={palletDims[d]}
              onChange={e =>
                setPalletDims(prev => ({ ...prev, [d]: Math.max(1, Number(e.target.value)) }))
              }
            />
          </div>
        ))}
      </div>

      {/* Rotate Selected */}
      <div className="cp-section">
        <div className="cp-stitle">Rotate Selected Box</div>
        <div className="cp-rot-grid">
          {ROTATIONS.map(r => (
            <button
              key={r.label}
              className="cp-rot-btn"
              disabled={!selectedId}
              onClick={() => onRotate(selectedId, r.axis, r.dir)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Statistics */}
      <div className="cp-section">
        <div className="cp-stitle">Statistics</div>
      </div>
      <div className="cp-stats">
        <div className="cp-stat">
          <div className="cp-stat-lbl">Boxes on Pallet</div>
          <div className="cp-stat-val gold">{boxCount}</div>
        </div>
        <div className="cp-stat">
          <div className="cp-stat-lbl">Volume Utilization</div>
          <div className={`cp-stat-val ${utilPct > 90 ? 'red' : 'gold'}`}>{utilPct}%</div>
        </div>
        <div className="cp-stat">
          <div className="cp-stat-lbl">Height Status</div>
          <div className={`cp-stat-val ${heightWarning ? 'red' : 'green'}`}>
            {heightWarning ? '⚠ EXCEEDED' : '✓ OK'}
          </div>
        </div>
      </div>

      <div className="cp-hint">
        Click a box to select · Drag to reposition · Use rotate buttons to change
        orientation · Boxes are clamped inside pallet boundaries
      </div>
    </div>
  )
}
