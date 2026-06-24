import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { VEHICLE_SCALE } from '../../constants/cityLayout'

// Ağ düğümü: bir kavşakta buluşan yol uçları
export interface RoadNode {
  pts: [number, number][]
  cum: number[]
  total: number
  width: number
  speed: number
}

export interface VehicleNet {
  roads: RoadNode[]
  // düğüm anahtarı → o düğüme değen [roadIndex, atStart]
  nodes: Map<string, { i: number; atStart: boolean }[]>
  nodeKey: (x: number, z: number) => string
}

export interface VehicleInit {
  url: string
  roadIdx: number
  dir: 1 | -1        // +1: start→end, -1: end→start
  t: number          // 0..1 başlangıç
  speedMul?: number  // acil araçlar için hız çarpanı
}

// Yol üzerinde arcDist konumunu örnekle (points sırasına göre)
function sampleArc(road: RoadNode, arcDist: number) {
  const { pts, cum, total } = road
  const d = Math.max(0, Math.min(total, arcDist))
  let seg = 0
  while (seg < cum.length - 2 && cum[seg + 1] < d) seg++
  const segLen = cum[seg + 1] - cum[seg] || 1e-6
  const lt = (d - cum[seg]) / segLen
  const [x1, z1] = pts[seg]
  const [x2, z2] = pts[seg + 1] ?? pts[seg]
  const dx = x2 - x1, dz = z2 - z1
  const l = Math.hypot(dx, dz) || 1
  return { x: x1 + dx * lt, z: z1 + dz * lt, dx: dx / l, dz: dz / l }
}

export default function NetworkVehicle({ net, init, night = false }: { net: VehicleNet; init: VehicleInit; night?: boolean }) {
  const ref = useRef<THREE.Group>(null!)
  const { scene } = useGLTF(init.url)
  const cloned = useMemo(() => scene.clone(true), [scene])

  // mutable durum
  const st = useRef({ roadIdx: init.roadIdx, dir: init.dir, t: init.t })

  useFrame((_, dt) => {
    const s = st.current
    let road = net.roads[s.roadIdx]
    if (!road || road.total < 0.1) return
    const step = Math.min(dt, 0.05)
    s.t += (road.speed * (init.speedMul ?? 1) * step) / road.total

    // yol bittiğinde kavşaktan devam et
    while (s.t >= 1) {
      s.t -= 1
      // varılan uç: dir=+1 → end (last), dir=-1 → start (first)
      const exitPt = s.dir === 1 ? road.pts[road.pts.length - 1] : road.pts[0]
      const key = net.nodeKey(exitPt[0], exitPt[1])
      const opts = (net.nodes.get(key) ?? []).filter((o) => o.i !== s.roadIdx)
      if (opts.length > 0) {
        // rastgele bir bağlı yola geç (deterministik değil; çeşitlilik)
        const pick = opts[Math.floor(Math.abs(Math.sin(s.t * 99 + s.roadIdx) ) * opts.length) % opts.length]
        s.roadIdx = pick.i
        s.dir = pick.atStart ? 1 : -1
      } else {
        // çıkış yok → geri dön (yok olma yerine)
        s.dir = (s.dir === 1 ? -1 : 1)
      }
      road = net.roads[s.roadIdx]
      if (!road || road.total < 0.1) return
    }

    // arcDist (points sırasına göre) ve seyahat yönü
    const arc = s.dir === 1 ? s.t * road.total : (1 - s.t) * road.total
    const p = sampleArc(road, arc)
    const fdx = p.dx * s.dir, fdz = p.dz * s.dir     // seyahat yönü
    // sağ şerit ofseti (seyahat yönüne göre sağ)
    const rx = fdz, rz = -fdx
    const off = road.width * 0.30

    ref.current.position.set(p.x + rx * off, 0, p.z + rz * off)
    ref.current.rotation.y = Math.atan2(fdx, fdz)
  })

  return (
    <group ref={ref}>
      <primitive object={cloned} scale={VEHICLE_SCALE} />
      {night && (
        <group scale={VEHICLE_SCALE}>
          {/* farlar (ön +z, beyaz) */}
          <mesh position={[-0.45, 0.45, 1.5]}>
            <sphereGeometry args={[0.18, 6, 6]} />
            <meshStandardMaterial color="#fff" emissive="#fff7d0" emissiveIntensity={2.2} />
          </mesh>
          <mesh position={[0.45, 0.45, 1.5]}>
            <sphereGeometry args={[0.18, 6, 6]} />
            <meshStandardMaterial color="#fff" emissive="#fff7d0" emissiveIntensity={2.2} />
          </mesh>
          {/* stoplar (arka -z, kırmızı) */}
          <mesh position={[-0.45, 0.45, -1.5]}>
            <sphereGeometry args={[0.14, 6, 6]} />
            <meshStandardMaterial color="#f33" emissive="#ff2200" emissiveIntensity={1.6} />
          </mesh>
          <mesh position={[0.45, 0.45, -1.5]}>
            <sphereGeometry args={[0.14, 6, 6]} />
            <meshStandardMaterial color="#f33" emissive="#ff2200" emissiveIntensity={1.6} />
          </mesh>
        </group>
      )}
    </group>
  )
}
