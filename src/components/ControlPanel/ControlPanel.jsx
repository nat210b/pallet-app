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
  const [tab, setTab] = useState('pallet')

  const navItems = useMemo(() => ([
    { id: 'pallet', label: 'Pallet', icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 7h16v10H4V7Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M4 11h16M8 7v10M16 7v10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    ) },
    { id: 'box', label: 'Box', icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M12 3v18M4 7.5l8 4.5 8-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
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
      <div className="cp-header" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button 
          className="cp-back-icon" 
          onClick={() => navigate('/')} 
          type="button" 
          title="Go Back"
          style={{ 
            background: 'none', border: 'none', cursor: 'pointer', 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--color-muted)', padding: '4px'
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
        </button>
        <div className="cp-logo">PalletX</div>
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
              <span className="cp-rail-ico" title={it.label}>{it.icon}</span>
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
                    type="number" min="0" max="1000"
                    value={boxDims[d] === '' ? '' : boxDims[d]}
                    onChange={e => setBoxDims(p => ({ ...p, [d]: e.target.value === '' ? '' : Number(e.target.value) }))}
                  />
                </div>
              ))}
              <div className="cp-field">
                <label>Amount</label>
                <input
                  type="number" min="1" max="500"
                  value={boxAmount === '' ? '' : boxAmount}
                  onChange={e => setBoxAmount(e.target.value === '' ? '' : Number(e.target.value))}
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
              <div className="cp-field" style={{ marginBottom: '16px' }}>
                <label>Standard Size</label>
                <select
                  className="cp-select"
                  style={{ backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%238e8ea8\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'%3E%3C/polyline%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', backgroundSize: '16px' }}
                  value={`${palletDims.length}x${palletDims.width}`}
                  onChange={e => {
                    const [len, wid] = e.target.value.split('x').map(Number);
                    setPalletDims(p => ({ ...p, length: len, width: wid }));
                  }}
                >
                  <option value="120x100">100x120 cm (ISO / North America)</option>
                  <option value="120x80">80x120 cm (EUR-Pallet)</option>
                  <option value="110x110">110x110 cm (Asia / Japan)</option>
                  <option value="121.9x101.6">101.6x121.9 cm (US 40"x48")</option>
                  <option value="116.5x116.5">116.5x116.5 cm (Australia)</option>
                </select>
              </div>
              <div className="cp-field">
                <label>Pallet Height (cm)</label>
                <input
                  type="number" min="0" max="1000"
                  value={palletHeight === '' ? '' : palletHeight}
                  onChange={e => setPalletHeight(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
              <div className="cp-field">
                <label>Limit Height (Total cm)</label>
                <input
                  type="number" min="0" max="2000"
                  value={palletDims.height === '' ? '' : palletDims.height}
                  onChange={e => setPalletDims(p => ({ ...p, height: e.target.value === '' ? '' : Number(e.target.value) }))}
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
