import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'

const PALETTE = [
  '#e8a838','#4a9edd','#6bcc7a','#cc6b9a',
  '#8b6bcc','#cc7a5a','#5accc0','#cc5a5a',
  '#a2cc5a','#5a8bcc','#cca85a','#5accaa',
]

// Shared drag plane (horizontal, Y-up)
const _dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const _hit       = new THREE.Vector3()

export default function DraggableBox({
  id, position, rotation, dims, palletDims,
  isSelected, isStaged,
  onSelect, onMove, onDropToPallet,
  colorIndex,
}) {
  const groupRef = useRef()
  const dragging = useRef(false)
  const offset   = useRef(new THREE.Vector3())
  const livePos  = useRef(new THREE.Vector3(...position))
  const wasOnPallet = useRef(!isStaged)

  const [hovered, setHovered] = useState(false)
  const { camera, gl, raycaster, pointer } = useThree()

  useCursor(hovered)

  // unit: 1 three.js unit = 10 cm
  const sx = dims.length / 10
  const sy = dims.height / 10
  const sz = dims.width  / 10

  const halfPW = palletDims.length / 10 / 2
  const halfPD = palletDims.width  / 10 / 2

  const color = PALETTE[colorIndex % PALETTE.length]

  // staged boxes look dimmer / outlined
  const opacity  = isStaged ? 0.55 : 0.92
  const emissive = isSelected ? color : hovered ? color : '#000000'
  const emissiveIntensity = isSelected ? 0.28 : hovered ? 0.1 : 0
  const edgeClr  = isSelected ? '#ffffff' : isStaged ? '#555577' : hovered ? '#9999bb' : '#2a2a3a'

  const edgeGeo = useMemo(
    () => new THREE.EdgesGeometry(new THREE.BoxGeometry(sx, sy, sz)),
    [sx, sy, sz]
  )

  // clamp to pallet footprint
  const clampToPallet = useCallback((x, z) => [
    Math.max(-halfPW + sx / 2, Math.min(halfPW - sx / 2, x)),
    Math.max(-halfPD + sz / 2, Math.min(halfPD - sz / 2, z)),
  ], [halfPW, halfPD, sx, sz])

  // sync livePos from prop (when not dragging)
  useEffect(() => {
    if (!dragging.current) livePos.current.set(...position)
  }, [position])

  const onPointerDown = useCallback((e) => {
    e.stopPropagation()
    onSelect(id)
    dragging.current = true
    wasOnPallet.current = !isStaged
    gl.domElement.style.cursor = 'grabbing'

    // set drag plane at box Y level
    _dragPlane.constant = -livePos.current.y
    raycaster.setFromCamera(pointer, camera)
    raycaster.ray.intersectPlane(_dragPlane, _hit)
    offset.current.copy(_hit).sub(livePos.current)
  }, [id, onSelect, isStaged, camera, gl, raycaster, pointer])

  const onPointerUp = useCallback((e) => {
    e.stopPropagation()
    if (!dragging.current) return
    dragging.current = false
    gl.domElement.style.cursor = ''

    const pos = livePos.current.toArray()
    const x = pos[0], z = pos[2]

    // Check if dropped inside pallet footprint
    const inPallet = (
      Math.abs(x) <= halfPW - sx / 2 &&
      Math.abs(z) <= halfPD - sz / 2
    )

    if (inPallet) {
      // Snap Y to pallet surface (y = half height)
      const snappedY = sy / 2
      livePos.current.y = snappedY
      onDropToPallet(id, [x, snappedY, z])
    } else {
      // Return to staged position or move freely if already placed
      onMove(id, livePos.current.toArray())
    }
  }, [id, onMove, onDropToPallet, gl, halfPW, halfPD, sx, sy, sz])

  useFrame(() => {
    if (!groupRef.current) return
    if (dragging.current) {
      _dragPlane.constant = -livePos.current.y
      raycaster.setFromCamera(pointer, camera)
      if (raycaster.ray.intersectPlane(_dragPlane, _hit)) {
        const rawX = _hit.x - offset.current.x
        const rawZ = _hit.z - offset.current.z

        // While dragging, if hovering pallet zone → snap to boundary
        const inPallet = Math.abs(rawX) <= halfPW && Math.abs(rawZ) <= halfPD
        if (inPallet) {
          const [cx, cz] = clampToPallet(rawX, rawZ)
          livePos.current.set(cx, livePos.current.y, cz)
        } else {
          livePos.current.set(rawX, livePos.current.y, rawZ)
        }
      }
    }
    groupRef.current.position.copy(livePos.current)
    groupRef.current.rotation.set(...rotation)
  })

  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      {/* Box body */}
      <mesh
        castShadow receiveShadow
        onPointerOver={e => { e.stopPropagation(); setHovered(true) }}
        onPointerOut={() => setHovered(false)}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        <boxGeometry args={[sx, sy, sz]} />
        <meshStandardMaterial
          color={color}
          roughness={isStaged ? 0.7 : 0.45}
          metalness={0.06}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
          transparent
          opacity={opacity}
        />
      </mesh>

      {/* Edges */}
      <lineSegments geometry={edgeGeo}>
        <lineBasicMaterial color={edgeClr} />
      </lineSegments>

      {/* Staged "drag me" indicator — pulsing ring */}
      {isStaged && !isSelected && (
        <mesh position={[0, sy / 2 + 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[sx * 0.35, sx * 0.42, 16]} />
          <meshBasicMaterial color={color} transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Selected dot */}
      {isSelected && (
        <mesh position={[0, sy / 2 + 0.08, 0]}>
          <sphereGeometry args={[0.07, 10, 10]} />
          <meshBasicMaterial color="#f5a623" />
        </mesh>
      )}
    </group>
  )
}
