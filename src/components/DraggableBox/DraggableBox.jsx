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
  snapTargets,
  isSelected, isStaged,
  onSelect, onMove, onDropToPallet,
  onDragStateChange,
  colorIndex,
}) {
  const groupRef = useRef()
  const dragging = useRef(false)
  const offset   = useRef(new THREE.Vector3())
  const livePos  = useRef(new THREE.Vector3(...position))

  const [hovered, setHovered] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const { camera, raycaster, pointer } = useThree()

  useCursor(hovered || isDragging, isDragging ? 'grabbing' : 'pointer')

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

  const getFootprintHalfExtents = useCallback((boxDims, boxRotation) => {
    const fx = boxDims.length / 10
    const fz = boxDims.width / 10
    const rotY = boxRotation?.[1] ?? 0
    const quarterTurns = ((Math.round(rotY / (Math.PI / 2)) % 4) + 4) % 4
    const swapped = quarterTurns % 2 === 1
    const sizeX = swapped ? fz : fx
    const sizeZ = swapped ? fx : fz
    return [sizeX / 2, sizeZ / 2]
  }, [])

  const [selfHalfX, selfHalfZ] = useMemo(
    () => getFootprintHalfExtents(dims, rotation),
    [dims, rotation, getFootprintHalfExtents]
  )

  // clamp to pallet footprint
  const clampToPallet = useCallback((x, z) => [
    Math.max(-halfPW + selfHalfX, Math.min(halfPW - selfHalfX, x)),
    Math.max(-halfPD + selfHalfZ, Math.min(halfPD - selfHalfZ, z)),
  ], [halfPW, halfPD, selfHalfX, selfHalfZ])

  const snapIn1D = useCallback((value, candidates, threshold) => {
    let best = value
    let bestDist = threshold
    for (const c of candidates) {
      const d = Math.abs(value - c)
      if (d < bestDist) {
        bestDist = d
        best = c
      }
    }
    return best
  }, [])

  const overlapAmount = useCallback((aMin, aMax, bMin, bMax) => {
    return Math.max(0, Math.min(aMax, bMax) - Math.max(aMin, bMin))
  }, [])

  // sync livePos from prop (when not dragging)
  useEffect(() => {
    if (!dragging.current) livePos.current.set(...position)
  }, [position])

  useEffect(() => () => onDragStateChange?.(false), [onDragStateChange])

  const onPointerDown = useCallback((e) => {
    e.stopPropagation()
    e.target.setPointerCapture?.(e.pointerId)
    onSelect(id)
    dragging.current = true
    setIsDragging(true)
    onDragStateChange?.(true)

    // set drag plane at box Y level
    _dragPlane.constant = -livePos.current.y
    raycaster.setFromCamera(pointer, camera)
    raycaster.ray.intersectPlane(_dragPlane, _hit)
    offset.current.copy(_hit).sub(livePos.current)
  }, [id, onSelect, onDragStateChange, camera, raycaster, pointer])

  const onPointerUp = useCallback((e) => {
    e.stopPropagation()
    e.target.releasePointerCapture?.(e.pointerId)
    if (!dragging.current) return
    dragging.current = false
    setIsDragging(false)
    onDragStateChange?.(false)

    const pos = livePos.current.toArray()
    const x = pos[0], z = pos[2]

    // Check if dropped inside pallet footprint
    const inPallet = (
      Math.abs(x) <= halfPW - selfHalfX &&
      Math.abs(z) <= halfPD - selfHalfZ
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
  }, [id, onMove, onDropToPallet, onDragStateChange, halfPW, halfPD, selfHalfX, selfHalfZ, sy])

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
          const SNAP_DIST = 0.12 // ~12cm (1 unit = 10cm)
          const GAP = 0 // flush edges

          let [cx, cz] = clampToPallet(rawX, rawZ)

          // 1) Snap to pallet edges
          cx = snapIn1D(cx, [-halfPW + selfHalfX, halfPW - selfHalfX], SNAP_DIST)
          cz = snapIn1D(cz, [-halfPD + selfHalfZ, halfPD - selfHalfZ], SNAP_DIST)

          // 2) Snap to nearby placed boxes (edge-to-edge) if ranges overlap on the other axis
          const targets = Array.isArray(snapTargets) ? snapTargets : []
          const selfZMin = cz - selfHalfZ
          const selfZMax = cz + selfHalfZ
          const selfXMin = cx - selfHalfX
          const selfXMax = cx + selfHalfX

          const minZOverlapForXSnap = Math.min(selfHalfZ * 2, 0.25) * 0.2
          const minXOverlapForZSnap = Math.min(selfHalfX * 2, 0.25) * 0.2

          const xCandidates = []
          const zCandidates = []

          for (const t of targets) {
            if (!t || t.id === id) continue
            const [tHalfX, tHalfZ] = getFootprintHalfExtents(t.dims, t.rotation)
            const tx = t.position?.[0] ?? 0
            const tz = t.position?.[2] ?? 0
            const tXMin = tx - tHalfX
            const tXMax = tx + tHalfX
            const tZMin = tz - tHalfZ
            const tZMax = tz + tHalfZ

            const zOverlap = overlapAmount(selfZMin, selfZMax, tZMin, tZMax)
            if (zOverlap > minZOverlapForXSnap) {
              xCandidates.push((tXMax + GAP) + selfHalfX)
              xCandidates.push((tXMin - GAP) - selfHalfX)
            }

            const xOverlap = overlapAmount(selfXMin, selfXMax, tXMin, tXMax)
            if (xOverlap > minXOverlapForZSnap) {
              zCandidates.push((tZMax + GAP) + selfHalfZ)
              zCandidates.push((tZMin - GAP) - selfHalfZ)
            }
          }

          cx = snapIn1D(cx, xCandidates, SNAP_DIST)
          cz = snapIn1D(cz, zCandidates, SNAP_DIST)

          ;[cx, cz] = clampToPallet(cx, cz)
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
