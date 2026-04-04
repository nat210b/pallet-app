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
const DEFAULT_PALLET_HEIGHT = 14

let _uid = 1

// ── Camera controller: smoothly animates to preset positions ──────
const _aabbEuler = new THREE.Euler(0, 0, 0, 'XYZ')
const _aabbM4 = new THREE.Matrix4()
const _aabbM3 = new THREE.Matrix3()

function CameraController({ mode, orbitRef }) {
  const { camera } = useThree()
  const targetPos = useRef(new THREE.Vector3(...CAMERA_PRESETS.free.position))
  const targetLook = useRef(new THREE.Vector3(...CAMERA_PRESETS.free.target))
  const animating = useRef(false)

  useEffect(() => {
    const preset = CAMERA_PRESETS[mode]
    if (preset) {
      targetPos.current.set(...preset.position)
      targetLook.current.set(...preset.target)
      animating.current = true
    }
  }, [mode])

  useEffect(() => {
    const controls = orbitRef.current
    if (!controls?.addEventListener) return

    const stop = () => { animating.current = false }
    controls.addEventListener('start', stop)
    return () => controls.removeEventListener('start', stop)
  }, [orbitRef])

  useFrame(() => {
    if (!animating.current) return

    camera.position.lerp(targetPos.current, 0.07)

    if (orbitRef.current) {
      orbitRef.current.target.lerp(targetLook.current, 0.07)
      orbitRef.current.update()

      const donePos = camera.position.distanceTo(targetPos.current) < 0.02
      const doneTarget = orbitRef.current.target.distanceTo(targetLook.current) < 0.02
      if (donePos && doneTarget) animating.current = false
    }
  })

  return null
}

export default function CalculatorPage() {
  const [boxes,       setBoxes]       = useState([])
  const [boxDims,     setBoxDims]     = useState(DEFAULT_BOX)
  const [palletDims,  setPalletDims]  = useState(DEFAULT_PALLET)
  const [palletHeight, setPalletHeight] = useState(DEFAULT_PALLET_HEIGHT)
  const [boxAmount,   setBoxAmount]   = useState(5)
  const [selectedId,  setSelectedId]  = useState(null)
  const [cameraMode,  setCameraMode]  = useState('iso')
  const [orbitEnabled, setOrbitEnabled] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const [contextMenu, setContextMenu] = useState(null)

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

  // Reusable AABB helper — must be declared BEFORE any useMemo that calls it
  const getRotatedHalfExtents = useCallback((d, rot) => {
    const hx = d.length / 10 / 2
    const hy = d.height / 10 / 2
    const hz = d.width  / 10 / 2
    const rx = rot?.[0] ?? 0
    const ry = rot?.[1] ?? 0
    const rz = rot?.[2] ?? 0

    _aabbEuler.set(rx, ry, rz, 'XYZ')
    _aabbM4.makeRotationFromEuler(_aabbEuler)
    _aabbM3.setFromMatrix4(_aabbM4)

    // Matrix3.elements is column-major: [ r11 r21 r31 r12 r22 r32 r13 r23 r33 ]
    const e = _aabbM3.elements
    const r11 = e[0], r12 = e[3], r13 = e[6]
    const r21 = e[1], r22 = e[4], r23 = e[7]
    const r31 = e[2], r32 = e[5], r33 = e[8]

    const ex = Math.abs(r11) * hx + Math.abs(r12) * hy + Math.abs(r13) * hz
    const ey = Math.abs(r21) * hx + Math.abs(r22) * hy + Math.abs(r23) * hz
    const ez = Math.abs(r31) * hx + Math.abs(r32) * hy + Math.abs(r33) * hz
    return [ex, ey, ez]
  }, [])

  const maxStackY = useMemo(() => {
    if (!placedBoxes.length) return 0
    return Math.max(...placedBoxes.map(b => {
      const [, hy] = getRotatedHalfExtents(b.dims, b.rotation)
      return b.position[1] + hy
    }))
  }, [placedBoxes, getRotatedHalfExtents])

  const maxLevels = useMemo(() => {
    if (!placedBoxes.length) return 0
    const EPS = 0.02
    const boxesSorted = placedBoxes.map(b => {
      const [, hy] = getRotatedHalfExtents(b.dims, b.rotation)
      return { ...b, _bottom: b.position[1] - hy, _top: b.position[1] + hy }
    }).sort((a, b) => a._bottom - b._bottom)

    const overlapXZ = (a, b) => {
      const [aHX, , aHZ] = getRotatedHalfExtents(a.dims, a.rotation)
      const [bHX, , bHZ] = getRotatedHalfExtents(b.dims, b.rotation)
      return (
        Math.abs(a.position[0] - b.position[0]) < (aHX + bHX - 0.0005) &&
        Math.abs(a.position[2] - b.position[2]) < (aHZ + bHZ - 0.0005)
      )
    }

    const levelById = new Map()
    let best = 1
    for (const b of boxesSorted) {
      let level = 1
      for (const a of boxesSorted) {
        if (a === b) break
        if (!overlapXZ(a, b)) continue
        if (Math.abs(b._bottom - a._top) <= EPS) {
          level = Math.max(level, (levelById.get(a.id) ?? 1) + 1)
        }
      }
      levelById.set(b.id, level)
      best = Math.max(best, level)
    }
    return best
  }, [placedBoxes, getRotatedHalfExtents])

  const palletHeightUnits = useMemo(
    () => Math.max(0, (Number(palletHeight) || 0) / 10),
    [palletHeight]
  )
  const limitHeightUnits = useMemo(
    () => Math.max(0, (Number(palletDims.height) || 0) / 10),
    [palletDims.height]
  )

  const totalHeightUnits = maxStackY + palletHeightUnits
  const heightWarning = totalHeightUnits > limitHeightUnits
  const totalHeightCm = useMemo(() => {
    const boxHeightCm = Math.max(0, totalHeightUnits * 10)
    return Math.round(boxHeightCm * 10) / 10
  }, [totalHeightUnits])

  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    const onKey = (e) => { if (e.key === 'Escape') close() }
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [contextMenu])

  const utilPct = useMemo(() => {
    const usableH = Math.max(0, palletDims.height - palletHeight)
    const palletVol = palletDims.length * palletDims.width * usableH
    if (!palletVol || !placedBoxes.length) return 0
    const boxVol = placedBoxes.reduce((a, b) => a + b.dims.length * b.dims.width * b.dims.height, 0)
    return Math.min(999, Math.round((boxVol / palletVol) * 100))
  }, [placedBoxes, palletDims, palletHeight])

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

  const handleDeleteBox = useCallback((id) => {
    setBoxes(prev => prev.filter(b => b.id !== id))
    setSelectedId(prev => (prev === id ? null : prev))
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

  const handleFillLevel = useCallback((boxId) => {
    setBoxes(prev => {
      const ref = prev.find(b => b.id === boxId)
      if (!ref) return prev

      const halfPW = palletDims.length / 10 / 2
      const halfPD = palletDims.width  / 10 / 2

      const [halfX, halfY, halfZ] = getRotatedHalfExtents(ref.dims, ref.rotation)
      const baseY = ref.staged ? halfY : (ref.position?.[1] ?? halfY)
      if (baseY + halfY + palletHeightUnits > limitHeightUnits + 0.0005) return prev

      // Use rotated extents for step sizes
      const stepX = halfX * 2
      const stepZ = halfZ * 2
      const minX = -halfPW + halfX, maxX = halfPW - halfX
      const minZ = -halfPD + halfZ, maxZ = halfPD - halfZ

      // Align grid to ref box position
      const anchorX = ref.position?.[0] ?? minX
      const anchorZ = ref.position?.[2] ?? minZ
      const kx = Math.round((anchorX - minX) / stepX)
      const kz = Math.round((anchorZ - minZ) / stepZ)
      let originX = anchorX - kx * stepX
      let originZ = anchorZ - kz * stepZ
      while (originX < minX - 1e-6) originX += stepX
      while (originX > minX + 1e-6) originX -= stepX
      while (originZ < minZ - 1e-6) originZ += stepZ
      while (originZ > minZ + 1e-6) originZ -= stepZ

      const placed = prev.filter(b => !b.staged)
      const EPS = 0.0005

      const collides = (x, z) => {
        for (const b of placed) {
          const [bhx, bhy, bhz] = getRotatedHalfExtents(b.dims, b.rotation)
          const [bx, by, bz] = b.position ?? [0, bhy, 0]
          if (
            Math.abs(x  - bx) < halfX + bhx - EPS &&
            Math.abs(baseY - by) < halfY + bhy - EPS &&
            Math.abs(z  - bz) < halfZ + bhz - EPS
          ) return true
        }
        return false
      }

      const newBoxes = []
      for (let z = originZ; z <= maxZ + EPS; z += stepZ) {
        for (let x = originX; x <= maxX + EPS; x += stepX) {
          if (collides(x, z)) continue
          newBoxes.push({
            id: _uid++,
            dims: { ...ref.dims },
            position: [x, baseY, z],
            rotation: [...(ref.rotation ?? [0, 0, 0])],
            staged: false,
            colorIndex: ref.colorIndex,
          })
        }
      }

      return newBoxes.length ? [...prev, ...newBoxes] : prev
    })
  }, [palletDims, palletHeightUnits, limitHeightUnits, getRotatedHalfExtents])

  const handleBoxContextMenu = useCallback((boxId, nativeEvent) => {
    const x = nativeEvent?.clientX ?? 0
    const y = nativeEvent?.clientY ?? 0
    setSelectedId(boxId)
    setContextMenu({ boxId, x, y })
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
  const controlsEnabled = orbitEnabled && !isDragging && !contextMenu
  const getRotateGlyph = useCallback((dir) => (dir === 1 ? '↺' : '↻'), [])
  const axisLabel = useCallback((axis) => String(axis ?? '').toUpperCase(), [])

  return (
    <div className="calc-root">

      {/* ── Left panel ── */}
      <ControlPanel
        boxDims={boxDims}       setBoxDims={setBoxDims}
        palletDims={palletDims} setPalletDims={setPalletDims}
        palletHeight={palletHeight} setPalletHeight={setPalletHeight}
        usableBoxHeight={Math.max(0, Math.round((palletDims.height - palletHeight) * 10) / 10)}
        totalHeight={totalHeightCm}
        limitHeight={palletDims.height}
        maxLevels={maxLevels}
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
            {stagedBoxes.length} staged · {placedBoxes.length} placed · {maxLevels} levels · {utilPct}% utilized
          </div>
        )}

        {/* Empty state */}
        {totalBoxes === 0 && (
          <div className="calc-empty">
            <div className="calc-empty-icon">📦</div>
            <div className="calc-empty-text">Set amount → click "Stage Boxes" to begin</div>
          </div>
        )}

        {contextMenu && (
          <div
            className="calc-context-menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onMouseDown={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
          >
            {/* ── Row 1: Rotate ── */}
            <div className="calc-ctx-label">Rotate 90°</div>
            <div className="calc-ctx-rot-grid">
              <button className="calc-ctx-rot-btn"
                onClick={() => { handleRotate(contextMenu.boxId, 'x',  1); setContextMenu(null) }}>
                <span className="calc-ctx-rot-icon">{getRotateGlyph(1)}</span>
                <span className="calc-ctx-rot-axis">{axisLabel('x')}</span>
              </button>
              <button className="calc-ctx-rot-btn"
                onClick={() => { handleRotate(contextMenu.boxId, 'x', -1); setContextMenu(null) }}>
                <span className="calc-ctx-rot-icon">{getRotateGlyph(-1)}</span>
                <span className="calc-ctx-rot-axis">{axisLabel('x')}</span>
              </button>
              <button className="calc-ctx-rot-btn"
                onClick={() => { handleRotate(contextMenu.boxId, 'y',  1); setContextMenu(null) }}>
                <span className="calc-ctx-rot-icon">{getRotateGlyph(1)}</span>
                <span className="calc-ctx-rot-axis">{axisLabel('y')}</span>
              </button>
              <button className="calc-ctx-rot-btn"
                onClick={() => { handleRotate(contextMenu.boxId, 'y', -1); setContextMenu(null) }}>
                <span className="calc-ctx-rot-icon">{getRotateGlyph(-1)}</span>
                <span className="calc-ctx-rot-axis">{axisLabel('y')}</span>
              </button>
              <button className="calc-ctx-rot-btn"
                onClick={() => { handleRotate(contextMenu.boxId, 'z',  1); setContextMenu(null) }}>
                <span className="calc-ctx-rot-icon">{getRotateGlyph(1)}</span>
                <span className="calc-ctx-rot-axis">{axisLabel('z')}</span>
              </button>
              <button className="calc-ctx-rot-btn"
                onClick={() => { handleRotate(contextMenu.boxId, 'z', -1); setContextMenu(null) }}>
                <span className="calc-ctx-rot-icon">{getRotateGlyph(-1)}</span>
                <span className="calc-ctx-rot-axis">{axisLabel('z')}</span>
              </button>
            </div>

            {/* ── Row 2: Fill level ── */}
            <div className="calc-ctx-divider" />
            <button
              className="calc-context-btn"
              onClick={() => { handleFillLevel(contextMenu.boxId); setContextMenu(null) }}
            >
              <span>⬛</span> Fill this level
            </button>

            {/* ── Row 3: Delete ── */}
            <button
              className="calc-context-btn calc-context-btn-danger"
              onClick={() => { handleDeleteBox(contextMenu.boxId); setContextMenu(null) }}
            >
              <span>✕</span> Delete box
            </button>
          </div>
        )}

        <Canvas
          shadows="percentage"
          dpr={[1, 2]}
          camera={{ position: [...CAMERA_PRESETS.iso.position], fov: 48, near: 0.1, far: 600 }}
          gl={{ antialias: true }}
          style={{ width: '100%', height: '100%' }}
          onPointerMissed={() => setSelectedId(null)}
          onContextMenu={(e) => e.preventDefault()}
        >
          <Suspense fallback={null}>
            <PalletScene
              boxes={boxes}
              palletDims={palletDims}
              palletHeight={palletHeight}
              heightLimit={limitHeightUnits}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onMove={handleMove}
              onDropToPallet={handleDropToPallet}
              heightWarning={heightWarning}
              onDragStateChange={setIsDragging}
              onBoxContextMenu={handleBoxContextMenu}
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
            maxDistance={220}
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
