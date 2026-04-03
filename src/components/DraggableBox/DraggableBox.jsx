import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'

const PALETTE = [
  '#e8a838','#4a9edd','#6bcc7a','#cc6b9a',
  '#8b6bcc','#cc7a5a','#5accc0','#cc5a5a',
  '#a2cc5a','#5a8bcc','#cca85a','#5accaa',
]

const _dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const _hit = new THREE.Vector3()

export default function DraggableBox({
  id, position, rotation, dims, palletDims,
  isSelected, onSelect, onMove, colorIndex,
}) {
  const groupRef  = useRef()
  const dragging  = useRef(false)
  const offset    = useRef(new THREE.Vector3())
  const livePos   = useRef(new THREE.Vector3(...position))

  const [hovered, setHovered] = useState(false)
  const { camera, gl, raycaster, pointer } = useThree()

  useCursor(hovered)

  // 1 unit = 10 cm
  const sx = dims.length / 10
  const sy = dims.height / 10
  const sz = dims.width  / 10

  const halfPW = palletDims.length / 10 / 2
  const halfPD = palletDims.width  / 10 / 2

  const color   = PALETTE[colorIndex % PALETTE.length]
  const edgeClr = isSelected ? '#ffffff' : hovered ? '#9999bb' : '#2a2a3a'

  const edgeGeo = useMemo(
    () => new THREE.EdgesGeometry(new THREE.BoxGeometry(sx, sy, sz)),
    [sx, sy, sz]
  )

  // clamp x/z inside pallet footprint
  const clamp = useCallback((x, z) => [
    Math.max(-halfPW + sx / 2, Math.min(halfPW - sx / 2, x)),
    Math.max(-halfPD + sz / 2, Math.min(halfPD - sz / 2, z)),
  ], [halfPW, halfPD, sx, sz])

  // sync livePos when position prop changes externally
  useEffect(() => {
    if (!dragging.current) livePos.current.set(...position)
  }, [position])

  const onPointerDown = useCallback((e) => {
    e.stopPropagation()
    onSelect(id)
    dragging.current = true
    gl.domElement.style.cursor = 'grabbing'
    _dragPlane.constant = -livePos.current.y
    raycaster.setFromCamera(pointer, camera)
    raycaster.ray.intersectPlane(_dragPlane, _hit)
    offset.current.copy(_hit).sub(livePos.current)
  }, [id, onSelect, camera, gl, raycaster, pointer])

  const onPointerUp = useCallback((e) => {
    e.stopPropagation()
    if (!dragging.current) return
    dragging.current = false
    gl.domElement.style.cursor = ''
    onMove(id, livePos.current.toArray())
  }, [id, onMove, gl])

  useFrame(() => {
    if (!groupRef.current) return
    if (dragging.current) {
      _dragPlane.constant = -livePos.current.y
      raycaster.setFromCamera(pointer, camera)
      if (raycaster.ray.intersectPlane(_dragPlane, _hit)) {
        const [cx, cz] = clamp(_hit.x - offset.current.x, _hit.z - offset.current.z)
        livePos.current.set(cx, livePos.current.y, cz)
      }
    }
    groupRef.current.position.copy(livePos.current)
    groupRef.current.rotation.set(...rotation)
  })

  return (
    <group ref={groupRef} position={position} rotation={rotation}>

      {/* Main box mesh */}
      <mesh
        castShadow
        receiveShadow
        onPointerOver={e => { e.stopPropagation(); setHovered(true) }}
        onPointerOut={() => setHovered(false)}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        <boxGeometry args={[sx, sy, sz]} />
        <meshStandardMaterial
          color={color}
          roughness={0.45}
          metalness={0.08}
          emissive={color}
          emissiveIntensity={isSelected ? 0.28 : hovered ? 0.1 : 0}
          transparent
          opacity={0.92}
        />
      </mesh>

      {/* Edge wireframe */}
      <lineSegments geometry={edgeGeo}>
        <lineBasicMaterial color={edgeClr} />
      </lineSegments>

      {/* Selection indicator */}
      {isSelected && (
        <mesh position={[0, sy / 2 + 0.07, 0]}>
          <sphereGeometry args={[0.07, 10, 10]} />
          <meshBasicMaterial color="#f5a623" />
        </mesh>
      )}
    </group>
  )
}
