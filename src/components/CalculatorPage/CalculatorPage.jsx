import { useState, useCallback, useMemo, useRef, useEffect, Suspense } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import ControlPanel from '../ControlPanel/ControlPanel'
import PalletScene from '../PalletScene/PalletScene'
import CameraToolbar, { CAMERA_PRESETS } from '../CameraToolbar/CameraToolbar'
import './CalculatorPageStyle.css'

const DEFAULT_BOX    = { length: 30, width: 20, height: 20 }
const DEFAULT_PALLET = { length: 120, width: 80, height: 150 }

let _uid = 1

// ── Camera controller: smoothly animates to preset positions ──────
function CameraController({ mode, orbitRef }) {
  const { camera } = useThree()
  const targetPos = useRef(new THREE.Vector3(...CAMERA_PRESETS.free.position))
  const targetLook = useRef(new THREE.Vector3(...CAMERA_PRESETS.free.target))

  useEffect(() => {
    const preset = CAMERA_PRESETS[mode]
    if (preset) {
      targetPos.current.set(...preset.position)
      targetLook.current.set(...preset.target)
    }
  }, [mode])

  useFrame(() => {
    // Smoothly lerp camera to target
    camera.position.lerp(targetPos.current, 0.07)
    // For locked modes keep looking at target
    if (mode !== 'free' && orbitRef.current) {
      orbitRef.current.target.lerp(targetLook.current, 0.07)
      orbitRef.current.update()
    }
  })

  return null
}

export default function CalculatorPage() {
  const [boxes,       setBoxes]       = useState([])
  const [boxDims,     setBoxDims]     = useState(DEFAULT_BOX)
  const [palletDims,  setPalletDims]  = useState(DEFAULT_PALLET)
  const [boxAmount,   setBoxAmount]   = useState(5)
  const [selectedId,  setSelectedId]  = useState(null)
  const [cameraMode,  setCameraMode]  = useState('iso')
  const [orbitEnabled, setOrbitEnabled] = useState(true)
  const [isDragging, setIsDragging] = useState(false)

  const orbitRef = useRef()

  // ── When camera mode changes, reset orbit target unless free ──
  const handleSetCameraMode = useCallback((mode) => {
    setCameraMode(mode)
    if (mode === 'free' && orbitRef.current) {
      // In free mode re-enable full orbit
      orbitRef.current.enableRotate = true
    }
  }, [])

  // ── Derived ────────────────────────────────────────────────────
  const placedBoxes = useMemo(() => boxes.filter(b => !b.staged), [boxes])
  const stagedBoxes = useMemo(() => boxes.filter(b =>  b.staged), [boxes])

  const maxStackY = useMemo(() => {
    if (!placedBoxes.length) return 0
    return Math.max(...placedBoxes.map(b => b.position[1] + b.dims.height / 10 / 2))
  }, [placedBoxes])

  const heightWarning = maxStackY > palletDims.height / 10

  const utilPct = useMemo(() => {
    const palletVol = palletDims.length * palletDims.width * palletDims.height
    if (!palletVol || !placedBoxes.length) return 0
    const boxVol = placedBoxes.reduce((a, b) => a + b.dims.length * b.dims.width * b.dims.height, 0)
    return Math.min(999, Math.round((boxVol / palletVol) * 100))
  }, [placedBoxes, palletDims])

  // ── Stage N boxes (unplaced, sitting in staging area) ──────────
  const handleStageBoxes = useCallback(() => {
    const newBoxes = Array.from({ length: boxAmount }, (_, i) => ({
      id:         _uid++,
      dims:       { ...boxDims },
      position:   [0, boxDims.height / 10 / 2, 0], // will be overridden by PalletScene layout
      rotation:   [0, 0, 0],
      staged:     true,
      colorIndex: (boxes.length + i) % 12,
    }))
    setBoxes(prev => [...prev, ...newBoxes])
  }, [boxAmount, boxDims, boxes.length])

  const handleClearAll = useCallback(() => {
    setBoxes([])
    setSelectedId(null)
  }, [])

  // ── Move a box freely (while on pallet, repositioning) ─────────
  const handleMove = useCallback((id, pos) => {
    setBoxes(prev => prev.map(b => b.id === id ? { ...b, position: pos } : b))
  }, [])

  // ── Drop staged box onto pallet → marks as placed ───────────────
  const handleDropToPallet = useCallback((id, pos) => {
    setBoxes(prev => prev.map(b =>
      b.id === id ? { ...b, position: pos, staged: false } : b
    ))
  }, [])

  // ── Rotate selected ────────────────────────────────────────────
  const handleRotate = useCallback((id, axis, dir) => {
    const STEP = Math.PI / 2
    setBoxes(prev => prev.map(b => {
      if (b.id !== id) return b
      const rot = [...b.rotation]
      rot[axis === 'x' ? 0 : axis === 'y' ? 1 : 2] += STEP * dir
      return { ...b, rotation: rot }
    }))
  }, [])

  const totalBoxes = boxes.length

  // OrbitControls config based on mode
  const isLockedMode = cameraMode !== 'free'
  const controlsEnabled = orbitEnabled && !isDragging

  return (
    <div className="calc-root">

      {/* ── Left panel ── */}
      <ControlPanel
        boxDims={boxDims}       setBoxDims={setBoxDims}
        palletDims={palletDims} setPalletDims={setPalletDims}
        boxAmount={boxAmount}   setBoxAmount={setBoxAmount}
        onStageBoxes={handleStageBoxes}
        onClearAll={handleClearAll}
        selectedId={selectedId}
        onRotate={handleRotate}
        stagedCount={stagedBoxes.length}
        placedCount={placedBoxes.length}
        utilPct={utilPct}
        heightWarning={heightWarning}
      />

      {/* ── 3D Canvas ── */}
      <div className="calc-canvas">

        {/* Camera mode badge */}
        <div className="calc-cam-badge">
          {CAMERA_PRESETS[cameraMode]?.icon} {CAMERA_PRESETS[cameraMode]?.label}
        </div>

        {/* HUD / warning */}
        {heightWarning ? (
          <div className="calc-warn">⚠ HEIGHT LIMIT EXCEEDED</div>
        ) : (
          <div className="calc-hud">
            <div className="calc-hud-dot" />
            {stagedBoxes.length} staged · {placedBoxes.length} placed · {utilPct}% utilized
          </div>
        )}

        {/* Empty state */}
        {totalBoxes === 0 && (
          <div className="calc-empty">
            <div className="calc-empty-icon">📦</div>
            <div className="calc-empty-text">Set amount → click "Stage Boxes" to begin</div>
          </div>
        )}

        <Canvas
          shadows="percentage"
          dpr={[1, 2]}
          camera={{ position: [...CAMERA_PRESETS.iso.position], fov: 48, near: 0.1, far: 200 }}
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
              onDropToPallet={handleDropToPallet}
              heightWarning={heightWarning}
              onDragStateChange={setIsDragging}
            />
          </Suspense>

          {/* Camera animation controller */}
          <CameraController
            mode={cameraMode}
            orbitRef={orbitRef}
          />

          <OrbitControls
            ref={orbitRef}
            makeDefault
            enabled={controlsEnabled}
            enableRotate={!isLockedMode || controlsEnabled}
            enablePan={true}
            enableZoom={true}
            enableDamping
            dampingFactor={0.08}
            minDistance={2}
            maxDistance={80}
            minPolarAngle={0.05}
            maxPolarAngle={Math.PI / 2.05}
          />
        </Canvas>
      </div>

      {/* ── Bottom toolbar ── */}
      <CameraToolbar
        cameraMode={cameraMode}
        setCameraMode={handleSetCameraMode}
        orbitEnabled={orbitEnabled}
        setOrbitEnabled={setOrbitEnabled}
      />
    </div>
  )
}
