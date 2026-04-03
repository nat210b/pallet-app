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

  const maxStackY = useMemo(() => {
    if (!placedBoxes.length) return 0
    return Math.max(...placedBoxes.map(b => b.position[1] + b.dims.height / 10 / 2))
  }, [placedBoxes])

  const maxLevels = useMemo(() => {
    if (!placedBoxes.length) return 0

    const EPS = 0.02

    const footprintHalfExtents = (dims, rotation) => {
      const fx = dims.length / 10
      const fz = dims.width / 10
      const rotY = rotation?.[1] ?? 0
      const quarterTurns = ((Math.round(rotY / (Math.PI / 2)) % 4) + 4) % 4
      const swapped = quarterTurns % 2 === 1
      const sizeX = swapped ? fz : fx
      const sizeZ = swapped ? fx : fz
      return [sizeX / 2, sizeZ / 2]
    }

    const overlapXZ = (a, b) => {
      const [aHalfX, aHalfZ] = footprintHalfExtents(a.dims, a.rotation)
      const [bHalfX, bHalfZ] = footprintHalfExtents(b.dims, b.rotation)
      const ax = a.position[0], az = a.position[2]
      const bx = b.position[0], bz = b.position[2]
      return (
        Math.abs(ax - bx) < (aHalfX + bHalfX - 0.0005) &&
        Math.abs(az - bz) < (aHalfZ + bHalfZ - 0.0005)
      )
    }

    const boxesSorted = placedBoxes.map(b => {
      const halfY = (b.dims.height / 10) / 2
      const y = b.position[1]
      return { ...b, _bottom: y - halfY, _top: y + halfY }
    }).sort((a, b) => a._bottom - b._bottom)

    const levelById = new Map()
    let best = 1

    for (const b of boxesSorted) {
      let level = 1
      for (const a of boxesSorted) {
        if (a === b) break
        if (!overlapXZ(a, b)) continue
        if (Math.abs(b._bottom - a._top) <= EPS) {
          const aLevel = levelById.get(a.id) ?? 1
          level = Math.max(level, aLevel + 1)
        }
      }
      levelById.set(b.id, level)
      best = Math.max(best, level)
    }

    return best
  }, [placedBoxes])

  const heightWarning = maxStackY > palletDims.height / 10

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
      const palletH = palletDims.height / 10

      const rotY = ref.rotation?.[1] ?? 0
      const quarterTurns = ((Math.round(rotY / (Math.PI / 2)) % 4) + 4) % 4
      const swapped = quarterTurns % 2 === 1

      const sizeX = (swapped ? ref.dims.width : ref.dims.length) / 10
      const sizeZ = (swapped ? ref.dims.length : ref.dims.width) / 10
      const halfX = sizeX / 2
      const halfZ = sizeZ / 2
      const halfY = (ref.dims.height / 10) / 2

      const baseY = ref.staged ? halfY : (ref.position?.[1] ?? halfY)
      if (baseY + halfY > palletH + 0.0005) return prev

      const minX = -halfPW + halfX
      const maxX = halfPW - halfX
      const minZ = -halfPD + halfZ
      const maxZ = halfPD - halfZ

      const stepX = sizeX
      const stepZ = sizeZ

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

      const footprintHalfExtents = (dims, rotation) => {
        const rY = rotation?.[1] ?? 0
        const qt = ((Math.round(rY / (Math.PI / 2)) % 4) + 4) % 4
        const sw = qt % 2 === 1
        const sX = (sw ? dims.width : dims.length) / 10
        const sZ = (sw ? dims.length : dims.width) / 10
        return [sX / 2, sZ / 2]
      }

      const overlaps3D = (a, b) => {
        return (
          Math.abs(a.x - b.x) < (a.hx + b.hx - 0.0005) &&
          Math.abs(a.y - b.y) < (a.hy + b.hy - 0.0005) &&
          Math.abs(a.z - b.z) < (a.hz + b.hz - 0.0005)
        )
      }

      const candidate = { x: 0, y: baseY, z: 0, hx: halfX, hy: halfY, hz: halfZ }

      const collides = (x, z) => {
        candidate.x = x
        candidate.z = z
        for (const b of placed) {
          const [bhx, bhz] = footprintHalfExtents(b.dims, b.rotation)
          const bhy = (b.dims.height / 10) / 2
          const bx = b.position?.[0] ?? 0
          const by = b.position?.[1] ?? bhy
          const bz = b.position?.[2] ?? 0
          if (overlaps3D(candidate, { x: bx, y: by, z: bz, hx: bhx, hy: bhy, hz: bhz })) return true
        }
        return false
      }

      const newBoxes = []
      const EPS = 0.0005
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
  }, [palletDims])

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
          >
            <button
              className="calc-context-btn"
              onClick={() => {
                handleFillLevel(contextMenu.boxId)
                setContextMenu(null)
              }}
            >
              Fill this level
            </button>
            <button
              className="calc-context-btn calc-context-btn-danger"
              onClick={() => {
                handleDeleteBox(contextMenu.boxId)
                setContextMenu(null)
              }}
            >
              Delete box
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
