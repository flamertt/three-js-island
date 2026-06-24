import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import type { VehicleData } from '../../types/vehicle'
import { VEHICLE_SCALE } from '../../constants/cityLayout'

interface Props { data: VehicleData }

// ─── Yol boyunca kümülatif mesafe tablosu ─────────────────────────────────────
interface PathData {
  pts: [number, number][]
  cumLen: number[]   // cumLen[i] = 0'dan i. noktaya mesafe
  total: number
}

function buildPath(waypoints: [number, number][], reverse: boolean): PathData {
  const pts = reverse ? [...waypoints].reverse() : waypoints
  const cumLen = [0]
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0]
    const dz = pts[i][1] - pts[i - 1][1]
    cumLen.push(cumLen[i - 1] + Math.sqrt(dx * dx + dz * dz))
  }
  return { pts, cumLen, total: cumLen[cumLen.length - 1] }
}

// t ∈ [0,1] → yol üzerindeki konum + yön açısı
function samplePath(p: PathData, t: number): { x: number; z: number; angle: number; perpX: number; perpZ: number } {
  const dist = t * p.total
  let seg = 0
  while (seg < p.cumLen.length - 2 && p.cumLen[seg + 1] < dist) seg++
  const segLen = p.cumLen[seg + 1] - p.cumLen[seg]
  const segT = segLen > 0 ? (dist - p.cumLen[seg]) / segLen : 0
  const [x1, z1] = p.pts[seg]
  const [x2, z2] = p.pts[seg + 1] ?? p.pts[seg]
  const dx = x2 - x1, dz = z2 - z1
  // Şerit ofseti: yön vektörüne dik
  return {
    x: x1 + dx * segT,
    z: z1 + dz * segT,
    angle: Math.atan2(dx, dz),
    perpX: -dz / (Math.sqrt(dx * dx + dz * dz) || 1),
    perpZ:  dx / (Math.sqrt(dx * dx + dz * dz) || 1),
  }
}

export default function AnimatedVehicle({ data }: Props) {
  const ref    = useRef<THREE.Group>(null!)
  const { scene } = useGLTF(data.url)
  const cloned = useMemo(() => scene.clone(true), [scene])

  const path = useMemo(() => buildPath(data.waypoints, data.reverse), [data])
  const t    = useRef(data.startT)

  useFrame((_, delta) => {
    if (path.total < 0.1) return
    t.current += (data.speed * delta) / path.total
    if (t.current > 1) t.current = 0

    const { x, z, angle, perpX, perpZ } = samplePath(path, t.current)
    const ox = perpX * data.lateralOffset
    const oz = perpZ * data.lateralOffset

    ref.current.position.set(x + ox, 0, z + oz)
    ref.current.rotation.y = angle
  })

  return (
    <group ref={ref}>
      <primitive object={cloned} scale={VEHICLE_SCALE} />
    </group>
  )
}
