import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Grid, Environment, ContactShadows, Html } from '@react-three/drei'
import * as THREE from 'three'
import DraggableBox from '../DraggableBox/DraggableBox'

const STAGING_X_OFFSET = -3.5
const STAGING_COLS     = 3
const STAGING_GAP      = 0.12

export default function PalletScene({
  boxes, palletDims,
  palletHeight,
  heightLimit,
  selectedId, onSelect,
  onMove, onDropToPallet,
  heightWarning,
  onDragStateChange,
  onBoxContextMenu,
}) {
  const pw = palletDims.length / 10
  const phTotal = Math.max(0, Number(heightLimit) || 0)
  const pd = palletDims.width  / 10

  const palletH = useMemo(() => Math.max(0.01, (Number(palletHeight) || 0) / 10), [palletHeight])
  const groundY = useMemo(() => -palletH - 0.01, [palletH])
  const limitTopY = useMemo(() => phTotal - palletH, [phTotal, palletH])

  const warnRef = useRef()

  useFrame(({ clock }) => {
    if (!warnRef.current) return
    warnRef.current.material.opacity = heightWarning
      ? 0.15 + Math.sin(clock.elapsedTime * 5) * 0.12
      : 0
  })


  const boundGeo   = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(pw, phTotal, pd)), [pw, phTotal, pd])
  const warnGeo    = useMemo(() => new THREE.PlaneGeometry(pw, pd), [pw, pd])
  const limLineGeo = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(pw, 0.004, pd)), [pw, pd])

  const staged = useMemo(() => boxes.filter(b => b.staged), [boxes])
  const placed = useMemo(() => boxes.filter(b => !b.staged), [boxes])

  const levelById = useMemo(() => {
    if (!placed.length) return new Map()

    const euler = new THREE.Euler(0, 0, 0, 'XYZ')
    const m4 = new THREE.Matrix4()
    const m3 = new THREE.Matrix3()

    const getRotatedHalfExtents = (dims, rot) => {
      const hx = dims.length / 10 / 2
      const hy = dims.height / 10 / 2
      const hz = dims.width / 10 / 2
      const rx = rot?.[0] ?? 0
      const ry = rot?.[1] ?? 0
      const rz = rot?.[2] ?? 0

      euler.set(rx, ry, rz, 'XYZ')
      m4.makeRotationFromEuler(euler)
      m3.setFromMatrix4(m4)

      // Matrix3.elements is column-major: [ r11 r21 r31 r12 r22 r32 r13 r23 r33 ]
      const el = m3.elements
      const r11 = el[0], r12 = el[3], r13 = el[6]
      const r21 = el[1], r22 = el[4], r23 = el[7]
      const r31 = el[2], r32 = el[5], r33 = el[8]

      const ex = Math.abs(r11) * hx + Math.abs(r12) * hy + Math.abs(r13) * hz
      const ey = Math.abs(r21) * hx + Math.abs(r22) * hy + Math.abs(r23) * hz
      const ez = Math.abs(r31) * hx + Math.abs(r32) * hy + Math.abs(r33) * hz
      return [ex, ey, ez]
    }

    const EPS_Y = 0.02
    const placedSorted = placed.map(b => {
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

    const levels = new Map()
    for (const b of placedSorted) {
      let level = 1
      for (const a of placedSorted) {
        if (a === b) break
        if (!overlapXZ(a, b)) continue
        if (Math.abs(b._bottom - a._top) <= EPS_Y) {
          level = Math.max(level, (levels.get(a.id) ?? 1) + 1)
        }
      }
      levels.set(b.id, level)
    }

    return levels
  }, [placed])

  const stagingPositions = useMemo(() => {
    return staged.map((box, i) => {
      const col = i % STAGING_COLS
      const row = Math.floor(i / STAGING_COLS)
      const sx  = box.dims.length / 10
      const sy  = box.dims.height / 10
      const sz  = box.dims.width  / 10
      const stagingX = STAGING_X_OFFSET - pw / 2 - (sx + STAGING_GAP) * (STAGING_COLS - 1 - col)
      const stagingZ = (row - 1) * (sz + STAGING_GAP)
      return [stagingX, sy / 2, stagingZ]
    })
  }, [staged, pw])

  const maxStagedRows  = Math.ceil(staged.length / STAGING_COLS)
  const stagingAreaW   = pw / 2 + Math.abs(STAGING_X_OFFSET) + 1.5
  const stagingAreaD   = Math.max(pd, maxStagedRows * 1.5 + 1)
  const stagingCenterX = STAGING_X_OFFSET - pw / 2 - stagingAreaW / 2 + 0.8

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[10, 14, 8]} intensity={1.1} castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={0.5} shadow-camera-far={80}
        shadow-camera-left={-20} shadow-camera-right={20}
        shadow-camera-top={20} shadow-camera-bottom={-20}
      />
      <directionalLight position={[-8, 10, -6]} intensity={0.35} />
      <Environment preset="city" />

      {/* Floor grid */}
      <Grid
        position={[0, groundY, 0]} args={[60, 60]} infiniteGrid
        cellSize={0.5} cellColor="#e2e8f0" cellThickness={0.8}
        sectionSize={2.5} sectionColor="#cbd5e1" sectionThickness={1.2}
        fadeDistance={28}
      />
      <ContactShadows position={[0, groundY + 0.01, 0]} opacity={0.45} scale={30} blur={2.5} far={6} />

      {/* ── PALLET ── */}
      <group position={[0, 0, 0]}>
        {/* Top deck boards (5 lengthwise) */}
        {[-0.42, -0.21, 0, 0.21, 0.42].map((zMod, i) => (
          <mesh key={`top-${i}`} position={[0, -0.15 * palletH / 2, zMod * pd]} receiveShadow castShadow>
            <boxGeometry args={[pw, 0.15 * palletH, pd * 0.16]} />
            <meshStandardMaterial color="#e3bc8e" roughness={0.8} metalness={0.02} />
          </mesh>
        ))}

        {/* Stringer boards (3 crosswise) */}
        {[-0.44, 0, 0.44].map((xMod, i) => (
          <mesh key={`stringer-${i}`} position={[xMod * pw, -0.15 * palletH - 0.15 * palletH / 2, 0]} receiveShadow castShadow>
            <boxGeometry args={[pw * 0.12, 0.15 * palletH, pd]} />
            <meshStandardMaterial color="#d1a675" roughness={0.85} metalness={0.02} />
          </mesh>
        ))}

        {/* Blocks (3x3 grid) */}
        {[-0.44, 0, 0.44].map((xMod, i) =>
          [-0.42, 0, 0.42].map((zMod, j) => (
            <mesh key={`block-${i}-${j}`} position={[xMod * pw, -0.30 * palletH - 0.55 * palletH / 2, zMod * pd]} receiveShadow castShadow>
              <boxGeometry args={[pw * 0.12, 0.55 * palletH, pd * 0.16]} />
              <meshStandardMaterial color="#b88b56" roughness={0.9} metalness={0.05} />
            </mesh>
          ))
        )}

        {/* Base boards (3 lengthwise) */}
        {[-0.42, 0, 0.42].map((zMod, i) => (
          <mesh key={`base-${i}`} position={[0, -0.85 * palletH - 0.15 * palletH / 2, zMod * pd]} receiveShadow castShadow>
            <boxGeometry args={[pw, 0.15 * palletH, pd * 0.16]} />
            <meshStandardMaterial color="#e3bc8e" roughness={0.85} metalness={0.02} />
          </mesh>
        ))}
      </group>

      {/* Pallet boundary wireframe */}
      <lineSegments geometry={boundGeo} position={[0, -palletH + phTotal / 2, 0]}>
        <lineBasicMaterial color={heightWarning ? '#ef4444' : 'rgba(15, 23, 42, 0.1)'} />
      </lineSegments>

      {/* Height limit line */}
      <lineSegments geometry={limLineGeo} position={[0, limitTopY, 0]}>
        <lineBasicMaterial color={heightWarning ? '#ff3333' : 'rgba(255,80,80,0.2)'} linewidth={2} />
      </lineSegments>

      {/* Warning plane */}
      <mesh ref={warnRef} geometry={warnGeo} position={[0, limitTopY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <meshBasicMaterial color="#ff2222" transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      {/* ── STAGING AREA ── */}
      {staged.length > 0 && (
        <>
          {/* Staging floor mat */}
          <mesh position={[stagingCenterX - 0.3, groundY + 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[stagingAreaW, stagingAreaD]} />
            <meshStandardMaterial color="#f1f5f9" roughness={1} transparent opacity={0.8} />
          </mesh>

          {/* Staging border */}
          <lineSegments position={[stagingCenterX - 0.3, 0, 0]}>
            <edgesGeometry args={[new THREE.BoxGeometry(stagingAreaW, 0.01, stagingAreaD)]} />
            <lineBasicMaterial color="rgba(15, 76, 129, 0.2)" />
          </lineSegments>

          {/* Label — HTML overlay (works in Vite / R3F without font files) */}
          <Html
            position={[stagingCenterX - 0.3, 0.02, stagingAreaD / 2 + 0.3]}
            rotation={[-Math.PI / 2, 0, 0]}
            center
            distanceFactor={6}
            style={{ pointerEvents: 'none' }}
          >
            <div style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#0f4c81',
              whiteSpace: 'nowrap',
              opacity: 0.8,
              textShadow: '0 0 8px rgba(15,76,129,0.2)',
            }}>
              ▸ Staging Area — drag boxes onto pallet
            </div>
          </Html>
        </>
      )}

      {/* ── STAGED BOXES ── */}
      {staged.map((box, i) => (
        <DraggableBox
          key={box.id}
          id={box.id}
          position={stagingPositions[i] || box.position}
          rotation={box.rotation}
          dims={box.dims}
          palletDims={palletDims}
          snapTargets={placed}
          isSelected={box.id === selectedId}
          isStaged={true}
          onSelect={onSelect}
          onMove={onMove}
          onDropToPallet={onDropToPallet}
          onDragStateChange={onDragStateChange}
          onContextMenu={onBoxContextMenu}
          colorIndex={box.colorIndex}
        />
      ))}

      {/* ── PLACED BOXES ── */}
      {placed.map((box) => (
        <DraggableBox
          key={box.id}
          id={box.id}
          position={box.position}
          rotation={box.rotation}
          dims={box.dims}
          palletDims={palletDims}
          snapTargets={placed}
          isSelected={box.id === selectedId}
          isStaged={false}
          onSelect={onSelect}
          onMove={onMove}
          onDropToPallet={onDropToPallet}
          onDragStateChange={onDragStateChange}
          onContextMenu={onBoxContextMenu}
          colorIndex={(levelById.get(box.id) ?? 1) - 1}
        />
      ))}
    </>
  )
}
