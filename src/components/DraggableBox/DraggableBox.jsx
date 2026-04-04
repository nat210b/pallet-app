import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'

const PALETTE = [
  '#e8a838','#4a9edd','#6bcc7a','#cc6b9a',
  '#8b6bcc','#cc7a5a','#5accc0','#cc5a5a',
  '#a2cc5a','#5a8bcc','#cca85a','#5accaa',
]

// Fixed floor-level drag plane — always at Y=0 (pallet surface)
// Mouse projects onto this plane to get stable XZ coordinates
const _floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const _hit        = new THREE.Vector3()
const _euler      = new THREE.Euler()
const _rotM4      = new THREE.Matrix4()
const _rotM3      = new THREE.Matrix3()

export default function DraggableBox({
  id, position, rotation, dims, palletDims,
  snapTargets,
  isSelected, isStaged,
  onSelect, onMove, onDropToPallet,
  onDragStateChange, onContextMenu,
  colorIndex,
}) {
  const groupRef  = useRef()
  const dragging  = useRef(false)
  const offset    = useRef(new THREE.Vector3())   // XZ offset only
  const livePos   = useRef(new THREE.Vector3(...position))
  const liveRot   = useRef(new THREE.Euler(...rotation))

  // Keep latest prop values accessible in useFrame without re-subscribing
  const posRef = useRef(position)
  const rotRef = useRef(rotation)
  useEffect(() => { posRef.current = position }, [position])
  useEffect(() => { rotRef.current = rotation }, [rotation])

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
  const edgeClr = isSelected ? '#ffffff' : isStaged ? '#555577' : hovered ? '#9999bb' : '#2a2a3a'
  const emissiveIntensity = isSelected ? 0.28 : hovered ? 0.1 : 0

  const edgeGeo = useMemo(
    () => new THREE.EdgesGeometry(new THREE.BoxGeometry(sx, sy, sz)),
    [sx, sy, sz]
  )

  // ── helpers ──────────────────────────────────────────────────────
  // Compute axis-aligned half-extents AFTER applying rotation
  // Works for any rotation (X, Y, Z axes), not just Y-only
  const getRotatedHalfExtents = useCallback((d, rot) => {
    const hx = d.length / 10 / 2
    const hy = d.height / 10 / 2
    const hz = d.width  / 10 / 2

    const rx = rot?.[0] ?? 0
    const ry = rot?.[1] ?? 0
    const rz = rot?.[2] ?? 0

    // AABB half-extents of a rotated box = |R| * halfExtents (R from Euler, order XYZ)
    _euler.set(rx, ry, rz, 'XYZ')
    _rotM4.makeRotationFromEuler(_euler)
    _rotM3.setFromMatrix4(_rotM4)

    // three.js Matrix3.elements is column-major:
    // [ r11 r21 r31 r12 r22 r32 r13 r23 r33 ]
    const e = _rotM3.elements
    const r11 = e[0], r12 = e[3], r13 = e[6]
    const r21 = e[1], r22 = e[4], r23 = e[7]
    const r31 = e[2], r32 = e[5], r33 = e[8]

    const ex = Math.abs(r11) * hx + Math.abs(r12) * hy + Math.abs(r13) * hz
    const ey = Math.abs(r21) * hx + Math.abs(r22) * hy + Math.abs(r23) * hz
    const ez = Math.abs(r31) * hx + Math.abs(r32) * hy + Math.abs(r33) * hz

    return [ex, ey, ez]
  }, [])

  // For XZ footprint snapping (legacy helper, now uses full AABB)
  const getHalfExtents = useCallback((d, rot) => {
    const [ex, , ez] = getRotatedHalfExtents(d, rot)
    return [ex, ez]
  }, [getRotatedHalfExtents])

  const [selfHX, selfHY, selfHZ] = useMemo(
    () => getRotatedHalfExtents(dims, rotation),
    [dims, rotation, getRotatedHalfExtents]
  )

  const clampToPallet = useCallback((x, z) => [
    Math.max(-halfPW + selfHX, Math.min(halfPW - selfHX, x)),
    Math.max(-halfPD + selfHZ, Math.min(halfPD - selfHZ, z)),
  ], [halfPW, halfPD, selfHX, selfHZ])

  const snap1D = useCallback((v, candidates, thr) => {
    let best = v, bestD = thr
    for (const c of candidates) {
      const d = Math.abs(v - c)
      if (d < bestD) { bestD = d; best = c }
    }
    return best
  }, [])

  /**
   * Given a desired XZ position on the pallet, find the correct Y
   * by stacking on top of any boxes whose footprint overlaps.
   * Uses only placed boxes (snapTargets), ignores self.
   */
  const computeStackY = useCallback((x, z) => {
    const targets = Array.isArray(snapTargets) ? snapTargets : []
    const EPS = 0.001
    let topY = 0   // pallet surface

    for (const t of targets) {
      if (!t || t.id === id) continue
      const [tHX, tHY, tHZ] = getRotatedHalfExtents(t.dims, t.rotation)
      const [tx, ty, tz] = t.position ?? [0, tHY, 0]

      const xOverlap = Math.abs(x - tx) < (selfHX + tHX - EPS)
      const zOverlap = Math.abs(z - tz) < (selfHZ + tHZ - EPS)
      if (xOverlap && zOverlap) {
        topY = Math.max(topY, ty + tHY)
      }
    }

    return topY + selfHY
  }, [snapTargets, id, getRotatedHalfExtents, selfHX, selfHY, selfHZ])

  // ── useFrame: single owner of transform ──────────────────────────
  useFrame(() => {
    if (!groupRef.current) return

    if (dragging.current) {
      // Project mouse onto the FIXED floor plane (Y=0)
      // This gives stable XZ regardless of box height → no flickering
      raycaster.setFromCamera(pointer, camera)
      if (raycaster.ray.intersectPlane(_floorPlane, _hit)) {
        const rawX = _hit.x - offset.current.x
        const rawZ = _hit.z - offset.current.z
        const inPallet = Math.abs(rawX) <= halfPW && Math.abs(rawZ) <= halfPD

        if (inPallet) {
          const SNAP = 0.14
          let [cx, cz] = clampToPallet(rawX, rawZ)

          // Snap to pallet edges
          cx = snap1D(cx, [-halfPW + selfHX, halfPW - selfHX], SNAP)
          cz = snap1D(cz, [-halfPD + selfHZ, halfPD - selfHZ], SNAP)

          // Snap edge-to-edge with other placed boxes
          const targets = Array.isArray(snapTargets) ? snapTargets : []
          const xC = [], zC = []
          for (const t of targets) {
            if (!t || t.id === id) continue
            const [tHX, tHZ] = getHalfExtents(t.dims, t.rotation)
            const [tx, , tz] = t.position ?? [0, 0, 0]
            const zOv = Math.max(0, Math.min(cz + selfHZ, tz + tHZ) - Math.max(cz - selfHZ, tz - tHZ))
            const xOv = Math.max(0, Math.min(cx + selfHX, tx + tHX) - Math.max(cx - selfHX, tx - tHX))
            if (zOv > selfHZ * 0.15) { xC.push(tx + tHX + selfHX); xC.push(tx - tHX - selfHX) }
            if (xOv > selfHX * 0.15) { zC.push(tz + tHZ + selfHZ); zC.push(tz - tHZ - selfHZ) }
          }
          cx = snap1D(cx, xC, SNAP)
          cz = snap1D(cz, zC, SNAP)
          ;[cx, cz] = clampToPallet(cx, cz)

          // Y is computed from XZ footprint overlap — no dependency on mouse Y
          const cy = computeStackY(cx, cz)
          livePos.current.set(cx, cy, cz)
        } else {
          // Outside pallet — float at staging height
          livePos.current.set(rawX, selfHY, rawZ)
        }
      }
    } else {
      // Idle — mirror React props
      const p = posRef.current
      const r = rotRef.current
      livePos.current.set(p[0], p[1], p[2])
      liveRot.current.set(r[0], r[1], r[2])
    }

    groupRef.current.position.copy(livePos.current)
    groupRef.current.rotation.copy(liveRot.current)
  })

  useEffect(() => () => onDragStateChange?.(false), [onDragStateChange])

  const onPointerDown = useCallback((e) => {
    e.stopPropagation()
    e.target.setPointerCapture?.(e.pointerId)
    onSelect(id)
    dragging.current = true
    onDragStateChange?.(true)
    gl.domElement.style.cursor = 'grabbing'

    // Capture XZ offset from floor plane so box doesn't jump to cursor center
    raycaster.setFromCamera(pointer, camera)
    if (raycaster.ray.intersectPlane(_floorPlane, _hit)) {
      // offset = where on the floor the mouse clicked, minus box XZ position
      offset.current.set(
        _hit.x - livePos.current.x,
        0,
        _hit.z - livePos.current.z
      )
    } else {
      offset.current.set(0, 0, 0)
    }
  }, [id, onSelect, onDragStateChange, camera, gl, raycaster, pointer])

  const onPointerUp = useCallback((e) => {
    e.stopPropagation()
    e.target.releasePointerCapture?.(e.pointerId)
    if (!dragging.current) return
    dragging.current = false
    onDragStateChange?.(false)
    gl.domElement.style.cursor = ''

    const [x, y, z] = livePos.current.toArray()
    const inPallet = Math.abs(x) <= halfPW - selfHX && Math.abs(z) <= halfPD - selfHZ

    if (inPallet) {
      onDropToPallet(id, [x, y, z])
    } else {
      onMove(id, [x, y, z])
    }
  }, [id, onMove, onDropToPallet, onDragStateChange, gl, halfPW, halfPD, selfHX, selfHZ])

  return (
    // No position/rotation props — useFrame owns the transform entirely
    <group ref={groupRef}>
      <mesh
        castShadow receiveShadow
        onPointerOver={e => { e.stopPropagation(); setHovered(true) }}
        onPointerOut={() => setHovered(false)}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onContextMenu={e => { e.stopPropagation(); onContextMenu?.(id, e.nativeEvent ?? e) }}
      >
        <boxGeometry args={[sx, sy, sz]} />
        <meshStandardMaterial
          color={color}
          roughness={isStaged ? 0.7 : 0.45}
          metalness={0.06}
          emissive={color}
          emissiveIntensity={emissiveIntensity}
          transparent={false}
          opacity={1}
        />
      </mesh>

      <lineSegments geometry={edgeGeo}>
        <lineBasicMaterial color={edgeClr} />
      </lineSegments>

      {isStaged && !isSelected && (
        <mesh position={[0, sy / 2 + 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[sx * 0.35, sx * 0.42, 16]} />
          <meshBasicMaterial color={color} transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
      )}

      {isSelected && (
        <mesh position={[0, sy / 2 + 0.08, 0]}>
          <sphereGeometry args={[0.07, 10, 10]} />
          <meshBasicMaterial color="#f5a623" />
        </mesh>
      )}
    </group>
  )
}
