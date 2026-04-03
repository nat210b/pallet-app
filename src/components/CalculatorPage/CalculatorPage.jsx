import { useState, useCallback, useMemo, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import ControlPanel from '../ControlPanel/ControlPanel'
import PalletScene from '../PalletScene/PalletScene'
import './CalculatorPageStyle.css'

// defaults (all in cm)
const DEFAULT_BOX    = { length: 30, width: 20, height: 20 }
const DEFAULT_PALLET = { length: 120, width: 80, height: 150 }

let _uid = 1

// place new box stacked on top of the highest existing box
function getStartPos(dims, existing) {
  const sy = dims.height / 10
  let topY = 0
  existing.forEach(b => {
    const t = b.position[1] + b.dims.height / 10 / 2
    if (t > topY) topY = t
  })
  return [0, topY + sy / 2, 0]
}

export default function CalculatorPage() {
  const [boxes,      setBoxes]      = useState([])
  const [boxDims,    setBoxDims]    = useState(DEFAULT_BOX)
  const [palletDims, setPalletDims] = useState(DEFAULT_PALLET)
  const [selectedId, setSelectedId] = useState(null)

  // ── derived values ────────────────────────────────────────────
  const maxStackY = useMemo(() => {
    if (!boxes.length) return 0
    return Math.max(...boxes.map(b => b.position[1] + b.dims.height / 10 / 2))
  }, [boxes])

  const heightWarning = maxStackY > palletDims.height / 10

  const utilPct = useMemo(() => {
    const palletVol = palletDims.length * palletDims.width * palletDims.height
    if (!palletVol || !boxes.length) return 0
    const boxVol = boxes.reduce((a, b) => a + b.dims.length * b.dims.width * b.dims.height, 0)
    return Math.min(999, Math.round((boxVol / palletVol) * 100))
  }, [boxes, palletDims])

  // ── actions ───────────────────────────────────────────────────
  const handleAddBox = useCallback(() => {
    setBoxes(prev => [
      ...prev,
      {
        id:       _uid++,
        dims:     { ...boxDims },
        position: getStartPos(boxDims, prev),
        rotation: [0, 0, 0],
      },
    ])
  }, [boxDims])

  const handleClearAll = useCallback(() => {
    setBoxes([])
    setSelectedId(null)
  }, [])

  const handleMove = useCallback((id, pos) => {
    setBoxes(prev => prev.map(b => b.id === id ? { ...b, position: pos } : b))
  }, [])

  const handleRotate = useCallback((id, axis, dir) => {
    const STEP = Math.PI / 2
    setBoxes(prev => prev.map(b => {
      if (b.id !== id) return b
      const rot = [...b.rotation]
      rot[axis === 'x' ? 0 : axis === 'y' ? 1 : 2] += STEP * dir
      return { ...b, rotation: rot }
    }))
  }, [])

  return (
    <div className="calc-root">

      {/* ── Left control panel ── */}
      <ControlPanel
        boxDims={boxDims}       setBoxDims={setBoxDims}
        palletDims={palletDims} setPalletDims={setPalletDims}
        onAddBox={handleAddBox}
        onClearAll={handleClearAll}
        selectedId={selectedId}
        onRotate={handleRotate}
        boxCount={boxes.length}
        utilPct={utilPct}
        heightWarning={heightWarning}
      />

      {/* ── 3D canvas area ── */}
      <div className="calc-canvas">

        {/* HUD / warning banner */}
        {heightWarning ? (
          <div className="calc-warn">⚠ HEIGHT LIMIT EXCEEDED</div>
        ) : (
          <div className="calc-hud">
            <div className="calc-hud-dot" />
            {boxes.length} box{boxes.length !== 1 ? 'es' : ''} &nbsp;·&nbsp;
            {utilPct}% utilized &nbsp;·&nbsp; drag to move · scroll to zoom
          </div>
        )}

        {/* Empty state */}
        {boxes.length === 0 && (
          <div className="calc-empty">
            <div className="calc-empty-icon">📦</div>
            <div className="calc-empty-text">Add a box to get started</div>
          </div>
        )}

        {/* Three.js canvas */}
        <Canvas
          shadows
          dpr={[1, 2]}
          camera={{ position: [9, 9, 13], fov: 48, near: 0.1, far: 200 }}
          gl={{ antialias: true }}
          style={{ width: '100%', height: '100%' }}
          onPointerMissed={() => setSelectedId(null)}
        >
          <Suspense fallback={null}>
            <PalletScene
              boxes={boxes}
              palletDims={palletDims}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onMove={handleMove}
              heightWarning={heightWarning}
            />
          </Suspense>

          <OrbitControls
            makeDefault
            enableDamping
            dampingFactor={0.08}
            minDistance={3}
            maxDistance={70}
            minPolarAngle={0.08}
            maxPolarAngle={Math.PI / 2.05}
          />
        </Canvas>
      </div>
    </div>
  )
}
