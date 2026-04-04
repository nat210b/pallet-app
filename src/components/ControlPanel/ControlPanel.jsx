import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './ControlPanelStyle.css'

export default function ControlPanel({
  boxDims,    setBoxDims,
  palletDims, setPalletDims,
  palletHeight, setPalletHeight,
  usableBoxHeight,
  totalHeight,
  limitHeight,
  maxLevels,
  boxAmount,  setBoxAmount,
  onStageBoxes, onClearAll,
  stagedCount, placedCount,
  utilPct, heightWarning,
}) {
  const navigate = useNavigate()
  const [tab, setTab] = useState('box')

  const navItems = useMemo(() => ([
    { id: 'box', label: 'Box', icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M12 3v18M4 7.5l8 4.5 8-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    ) },
    { id: 'pallet', label: 'Pallet', icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 7h16v10H4V7Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M4 11h16M8 7v10M16 7v10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    ) },
    { id: 'stat', label: 'Stats', icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 19V5M5 19h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M8 16v-5M12 16V8M16 16v-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ) },
  ]), [])

  return (
    <div className="cp-root">
      <div className="cp-header">
        <div className="cp-logo">PalletPro</div>
        <button className="cp-back" onClick={() => navigate('/')} type="button">{'<- Back'}</button>
      </div>

      <div className="cp-body">
        <nav className="cp-rail" aria-label="Panel navigation">
          {navItems.map((it) => (
            <button
              key={it.id}
              className={`cp-rail-btn ${tab === it.id ? 'active' : ''}`}
              onClick={() => setTab(it.id)}
              type="button"
            >
              <span className="cp-rail-ico">{it.icon}</span>
              <span className="cp-rail-lbl">{it.label}</span>
            </button>
          ))}
        </nav>

        <div className="cp-content">
          {tab === 'box' && (
            <div className="cp-section">
              <div className="cp-stitle">Box</div>
              {['length', 'width', 'height'].map(d => (
                <div className="cp-field" key={d}>
                  <label>{d.charAt(0).toUpperCase() + d.slice(1)} (cm)</label>
                  <input
                    type="number" min="1" max="300"
                    value={boxDims[d]}
                    onChange={e => setBoxDims(p => ({ ...p, [d]: Math.max(1, Number(e.target.value)) }))}
                  />
                </div>
              ))}
              <div className="cp-field">
                <label>Amount</label>
                <input
                  type="number" min="1" max="200"
                  value={boxAmount}
                  onChange={e => setBoxAmount(Math.max(1, Number(e.target.value)))}
                />
              </div>
              <button className="cp-btn-add" onClick={onStageBoxes} type="button">
                + Stage {boxAmount} Box{boxAmount !== 1 ? 'es' : ''}
              </button>
              <button className="cp-btn-clear" disabled={stagedCount + placedCount === 0} onClick={onClearAll} type="button">
                Clear All
              </button>
            </div>
          )}

          {tab === 'pallet' && (
            <div className="cp-section">
              <div className="cp-stitle">Pallet</div>
              {['length', 'width'].map(d => (
                <div className="cp-field" key={d}>
                  <label>{d.charAt(0).toUpperCase() + d.slice(1)} (cm)</label>
                  <input
                    type="number" min="1" max="600"
                    value={palletDims[d]}
                    onChange={e => setPalletDims(p => ({ ...p, [d]: Math.max(1, Number(e.target.value)) }))}
                  />
                </div>
              ))}
              <div className="cp-field">
                <label>Pallet Height (cm)</label>
                <input
                  type="number" min="0" max="200"
                  value={palletHeight}
                  onChange={e => setPalletHeight(Math.max(0, Number(e.target.value)))}
                />
              </div>
              <div className="cp-field">
                <label>Limit Height (Total cm)</label>
                <input
                  type="number" min="1" max="600"
                  value={palletDims.height}
                  onChange={e => setPalletDims(p => ({ ...p, height: Math.max(1, Number(e.target.value)) }))}
                />
              </div>
              <div className="cp-hint" style={{ marginTop: 8 }}>
                Usable box height: {usableBoxHeight} cm (Limit - Pallet)
              </div>
            </div>
          )}

          {tab === 'stat' && (
            <>
              <div className="cp-section">
                <div className="cp-stitle">Stats</div>
              </div>
              <div className="cp-stats">
                <div className="cp-stat">
                  <div className="cp-stat-lbl">Staged (unplaced)</div>
                  <div className="cp-stat-val gold">{stagedCount}</div>
                </div>
                <div className="cp-stat">
                  <div className="cp-stat-lbl">Placed on pallet</div>
                  <div className="cp-stat-val green">{placedCount}</div>
                </div>
                <div className="cp-stat">
                  <div className="cp-stat-lbl">Levels</div>
                  <div className="cp-stat-val gold">{maxLevels}</div>
                </div>
                <div className="cp-stat">
                  <div className="cp-stat-lbl">Total height (cm)</div>
                  <div className={`cp-stat-val ${heightWarning ? 'red' : 'gold'}`}>{totalHeight}</div>
                </div>
                <div className="cp-stat">
                  <div className="cp-stat-lbl">Limit height (cm)</div>
                  <div className="cp-stat-val gold">{limitHeight}</div>
                </div>
                <div className="cp-stat">
                  <div className="cp-stat-lbl">Volume utilization</div>
                  <div className={`cp-stat-val ${utilPct > 90 ? 'red' : 'gold'}`}>{utilPct}%</div>
                </div>
                <div className="cp-stat">
                  <div className="cp-stat-lbl">Height status</div>
                  <div className={`cp-stat-val ${heightWarning ? 'red' : 'green'}`}>
                    {heightWarning ? 'EXCEEDED' : 'OK'}
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="cp-hint">
            Click to select. Right-click a box to rotate, fill level, or delete.
          </div>
        </div>
      </div>
    </div>
  )
}
