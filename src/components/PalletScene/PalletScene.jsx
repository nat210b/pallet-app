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
  selectedId, onSelect,
  onMove, onDropToPallet,
  heightWarning,
  onDragStateChange,
  onBoxContextMenu,
}) {
  const pw = palletDims.length / 10
  const ph = palletDims.height / 10
  const pd = palletDims.width  / 10

  const warnRef = useRef()

  useFrame(({ clock }) => {
    if (!warnRef.current) return
    warnRef.current.material.opacity = heightWarning
      ? 0.15 + Math.sin(clock.elapsedTime * 5) * 0.12
      : 0
  })

  const planks = useMemo(() =>
    [-pw * 0.33, 0, pw * 0.33].map(x => [x, 0.001, 0]), [pw])

  const feet = useMemo(() => [
    [-pw / 2 + 0.12, -0.08, -pd / 2 + 0.12],
    [ pw / 2 - 0.12, -0.08, -pd / 2 + 0.12],
    [-pw / 2 + 0.12, -0.08,  pd / 2 - 0.12],
    [ pw / 2 - 0.12, -0.08,  pd / 2 - 0.12],
  ], [pw, pd])

  const boundGeo   = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(pw, ph, pd)), [pw, ph, pd])
  const warnGeo    = useMemo(() => new THREE.PlaneGeometry(pw, pd), [pw, pd])
  const limLineGeo = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(pw, 0.004, pd)), [pw, pd])

  const staged = boxes.filter(b => b.staged)
  const placed = boxes.filter(b => !b.staged)

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
        position={[0, -0.13, 0]} args={[60, 60]} infiniteGrid
        cellSize={0.5} cellColor="#1a1a28" cellThickness={0.5}
        sectionSize={2.5} sectionColor="#252535" sectionThickness={0.9}
        fadeDistance={28}
      />
      <ContactShadows position={[0, -0.12, 0]} opacity={0.45} scale={30} blur={2.5} far={6} />

      {/* ── PALLET ── */}
      <mesh position={[0, -0.06, 0]} receiveShadow>
        <boxGeometry args={[pw, 0.12, pd]} />
        <meshStandardMaterial color="#8B6C14" roughness={0.85} metalness={0.04} />
      </mesh>
      {planks.map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]}>
          <boxGeometry args={[0.055, 0.013, pd]} />
          <meshStandardMaterial color="#6B4F0E" roughness={0.9} />
        </mesh>
      ))}
      {feet.map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]}>
          <boxGeometry args={[0.13, 0.08, 0.13]} />
          <meshStandardMaterial color="#5a4010" roughness={0.9} />
        </mesh>
      ))}

      {/* Pallet boundary wireframe */}
      <lineSegments geometry={boundGeo} position={[0, ph / 2, 0]}>
        <lineBasicMaterial color={heightWarning ? '#ff5555' : 'rgba(255,255,255,0.06)'} />
      </lineSegments>

      {/* Height limit line */}
      <lineSegments geometry={limLineGeo} position={[0, ph, 0]}>
        <lineBasicMaterial color={heightWarning ? '#ff3333' : 'rgba(255,80,80,0.2)'} linewidth={2} />
      </lineSegments>

      {/* Warning plane */}
      <mesh ref={warnRef} geometry={warnGeo} position={[0, ph, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <meshBasicMaterial color="#ff2222" transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      {/* ── STAGING AREA ── */}
      {staged.length > 0 && (
        <>
          {/* Staging floor mat */}
          <mesh position={[stagingCenterX - 0.3, -0.115, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[stagingAreaW, stagingAreaD]} />
            <meshStandardMaterial color="#1a1a2e" roughness={1} transparent opacity={0.75} />
          </mesh>

          {/* Staging border */}
          <lineSegments position={[stagingCenterX - 0.3, 0, 0]}>
            <edgesGeometry args={[new THREE.BoxGeometry(stagingAreaW, 0.01, stagingAreaD)]} />
            <lineBasicMaterial color="rgba(245,166,35,0.3)" />
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
              color: '#f5a623',
              whiteSpace: 'nowrap',
              opacity: 0.8,
              textShadow: '0 0 8px rgba(245,166,35,0.5)',
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
          colorIndex={box.colorIndex}
        />
      ))}
    </>
  )
}
