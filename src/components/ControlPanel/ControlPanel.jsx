import { useNavigate } from 'react-router-dom'
import './ControlPanelStyle.css'

export default function ControlPanel({
  boxDims,    setBoxDims,
  palletDims, setPalletDims,
  boxAmount,  setBoxAmount,
  onStageBoxes, onClearAll,
  stagedCount, placedCount,
  utilPct, heightWarning,
}) {
  const navigate = useNavigate()

  return (
    <div className="cp-root">

      {/* Header */}
      <div className="cp-header">
        <div className="cp-logo">PalletPro</div>
        <button className="cp-back" onClick={() => navigate('/')}>← Back</button>
      </div>

      {/* Box Setup */}
      <div className="cp-section">
        <div className="cp-stitle">Box Dimensions (cm)</div>
        {['length', 'width', 'height'].map(d => (
          <div className="cp-field" key={d}>
            <label>{d.charAt(0).toUpperCase() + d.slice(1)}</label>
            <input
              type="number" min="1" max="300"
              value={boxDims[d]}
              onChange={e => setBoxDims(p => ({ ...p, [d]: Math.max(1, Number(e.target.value)) }))}
            />
          </div>
        ))}
        <div className="cp-field">
          <label>Amount of Boxes</label>
          <input
            type="number" min="1" max="200"
            value={boxAmount}
            onChange={e => setBoxAmount(Math.max(1, Number(e.target.value)))}
          />
        </div>
        <button className="cp-btn-add" onClick={onStageBoxes}>
          ＋ Stage {boxAmount} Box{boxAmount !== 1 ? 'es' : ''}
        </button>
        <button className="cp-btn-clear" disabled={stagedCount + placedCount === 0} onClick={onClearAll}>
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
              onChange={e => setPalletDims(p => ({ ...p, [d]: Math.max(1, Number(e.target.value)) }))}
            />
          </div>
        ))}
      </div>

      {/* Statistics */}
      <div className="cp-section">
        <div className="cp-stitle">Statistics</div>
      </div>
      <div className="cp-stats">
        <div className="cp-stat">
          <div className="cp-stat-lbl">Staged (unplaced)</div>
          <div className="cp-stat-val gold">{stagedCount}</div>
        </div>
        <div className="cp-stat">
          <div className="cp-stat-lbl">Placed on Pallet</div>
          <div className="cp-stat-val green">{placedCount}</div>
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
        Click to select · Right-click a box to rotate, fill level, or delete
      </div>
    </div>
  )
}
