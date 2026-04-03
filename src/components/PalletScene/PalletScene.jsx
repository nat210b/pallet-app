import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Grid, Environment, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'
import DraggableBox from '../DraggableBox/DraggableBox'

export default function PalletScene({
  boxes, palletDims, selectedId, onSelect, onMove, heightWarning,
}) {
  // convert cm → Three.js units (1 unit = 10 cm)
  const pw = palletDims.length / 10
  const ph = palletDims.height / 10
  const pd = palletDims.width  / 10

  const warnRef = useRef()

  // pulse the warning plane opacity
  useFrame(({ clock }) => {
    if (!warnRef.current) return
    warnRef.current.material.opacity = heightWarning
      ? 0.15 + Math.sin(clock.elapsedTime * 5) * 0.12
      : 0
  })

  // pallet top decorative planks
  const planks = useMemo(() =>
    [-pw * 0.33, 0, pw * 0.33].map(x => [x, 0.001, 0])
  , [pw])

  // 4 corner support feet
  const feet = useMemo(() => [
    [-pw / 2 + 0.12, -0.08, -pd / 2 + 0.12],
    [ pw / 2 - 0.12, -0.08, -pd / 2 + 0.12],
    [-pw / 2 + 0.12, -0.08,  pd / 2 - 0.12],
    [ pw / 2 - 0.12, -0.08,  pd / 2 - 0.12],
  ], [pw, pd])

  // reuse geometries
  const boundGeo = useMemo(
    () => new THREE.EdgesGeometry(new THREE.BoxGeometry(pw, ph, pd)),
    [pw, ph, pd]
  )
  const warnGeo = useMemo(() => new THREE.PlaneGeometry(pw, pd), [pw, pd])
  const limLineGeo = useMemo(
    () => new THREE.EdgesGeometry(new THREE.BoxGeometry(pw, 0.004, pd)),
    [pw, pd]
  )

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.45} />
      <directionalLight
        position={[10, 14, 8]} intensity={1.1}
        castShadow shadow-mapSize={[1024, 1024]}
        shadow-camera-near={0.5} shadow-camera-far={80}
        shadow-camera-left={-15} shadow-camera-right={15}
        shadow-camera-top={15} shadow-camera-bottom={-15}
      />
      <directionalLight position={[-8, 10, -6]} intensity={0.35} />
      <Environment preset="city" />

      {/* Floor grid */}
      <Grid
        position={[0, -0.13, 0]}
        args={[40, 40]}
        infiniteGrid
        cellSize={0.5}
        cellColor="#1e1e2a"
        cellThickness={0.5}
        sectionSize={2.5}
        sectionColor="#2a2a3c"
        sectionThickness={0.9}
        fadeDistance={24}
      />

      {/* Floor contact shadow */}
      <ContactShadows
        position={[0, -0.12, 0]}
        opacity={0.5} scale={22} blur={2.5} far={6}
      />

      {/* ── Pallet base platform ── */}
      <mesh position={[0, -0.06, 0]} receiveShadow>
        <boxGeometry args={[pw, 0.12, pd]} />
        <meshStandardMaterial color="#8B6C14" roughness={0.85} metalness={0.04} />
      </mesh>

      {/* Top planks (visual stripes) */}
      {planks.map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]}>
          <boxGeometry args={[0.055, 0.013, pd]} />
          <meshStandardMaterial color="#6B4F0E" roughness={0.9} />
        </mesh>
      ))}

      {/* Corner feet */}
      {feet.map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]}>
          <boxGeometry args={[0.13, 0.08, 0.13]} />
          <meshStandardMaterial color="#5a4010" roughness={0.9} />
        </mesh>
      ))}

      {/* ── Pallet boundary wireframe ── */}
      <lineSegments geometry={boundGeo} position={[0, ph / 2, 0]}>
        <lineBasicMaterial
          color={heightWarning ? '#ff5555' : 'rgba(255,255,255,0.06)'}
        />
      </lineSegments>

      {/* ── Height limit line (always visible) ── */}
      <lineSegments geometry={limLineGeo} position={[0, ph, 0]}>
        <lineBasicMaterial
          color={heightWarning ? '#ff3333' : 'rgba(255,80,80,0.22)'}
          linewidth={2}
        />
      </lineSegments>

      {/* ── Warning plane (pulsing) ── */}
      <mesh
        ref={warnRef}
        geometry={warnGeo}
        position={[0, ph, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <meshBasicMaterial
          color="#ff2222"
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* ── Boxes ── */}
      {boxes.map((box, i) => (
        <DraggableBox
          key={box.id}
          id={box.id}
          position={box.position}
          rotation={box.rotation}
          dims={box.dims}
          palletDims={palletDims}
          isSelected={box.id === selectedId}
          onSelect={onSelect}
          onMove={onMove}
          colorIndex={i}
        />
      ))}
    </>
  )
}
