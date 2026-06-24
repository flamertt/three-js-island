import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import {
  shipCargoA, shipCargoB, shipLiner, shipLinerSm, shipLarge,
  boatTugA, boatSpeedA, boatFishing,
} from '../../assets/models'
import { SHIP_SCALE, BOAT_SCALE, COAST_OUTER_MAX } from '../../constants/cityLayout'

interface VesselSpec {
  url: string
  scale: number
  rx: number; rz: number      // elips yarıçapları
  cx: number; cz: number      // elips merkezi
  speed: number               // rad/sec
  phase: number               // başlangıç açısı
  dir: 1 | -1                 // yön
  bob: number                 // dalgada sallanma genliği
}

// Şehrin etrafında elips yörüngelerde dolaşan gemiler.
// Kumsal dahil adanın en dış noktası = COAST_OUTER_MAX. Elips adayı tamamen
// dışarıda bırakmak için HEM rx HEM rz ≥ COAST_OUTER_MAX + güvenli pay olmalı.
const MIN_ORBIT = COAST_OUTER_MAX + 22
const VESSELS: VesselSpec[] = [
  // Büyük kargo gemileri — geniş yörünge
  { url: shipCargoA, scale: SHIP_SCALE,       rx: 320, rz: 300, cx: 0, cz: 0, speed: 0.045, phase: 0.0, dir: 1,  bob: 0.6 },
  { url: shipLiner,  scale: SHIP_SCALE * 1.1, rx: 350, rz: 320, cx: 0, cz: 0, speed: 0.035, phase: 2.1, dir: 1,  bob: 0.5 },
  { url: shipCargoB, scale: SHIP_SCALE,       rx: 300, rz: 340, cx: 0, cz: 0, speed: 0.04,  phase: 4.0, dir: -1, bob: 0.6 },
  { url: shipLarge,  scale: SHIP_SCALE,       rx: 370, rz: 290, cx: 0, cz: 0, speed: 0.03,  phase: 1.0, dir: -1, bob: 0.5 },
  // Orta + küçük motorlu tekneler — kıyıya yakın ama daire tamamen dışında
  { url: shipLinerSm, scale: SHIP_SCALE * 0.8, rx: MIN_ORBIT + 20, rz: MIN_ORBIT + 5,  cx: 0, cz: 0, speed: 0.06, phase: 3.3, dir: 1,  bob: 0.7 },
  { url: boatTugA,    scale: BOAT_SCALE * 1.2, rx: MIN_ORBIT + 10, rz: MIN_ORBIT,      cx: 0, cz: 0, speed: 0.07, phase: 5.5, dir: -1, bob: 0.9 },
  { url: boatSpeedA,  scale: BOAT_SCALE * 0.9, rx: MIN_ORBIT,      rz: MIN_ORBIT + 8,  cx: 0, cz: 0, speed: 0.14, phase: 1.8, dir: 1,  bob: 1.3 },
  { url: boatFishing, scale: BOAT_SCALE,       rx: MIN_ORBIT + 18, rz: MIN_ORBIT + 12, cx: 0, cz: 0, speed: 0.08, phase: 4.6, dir: -1, bob: 1.1 },
]

function Vessel({ spec, night }: { spec: VesselSpec; night: boolean }) {
  const ref = useRef<THREE.Group>(null!)
  const { scene } = useGLTF(spec.url)
  const cloned = useMemo(() => scene.clone(true), [scene])
  // gece: gemi gövdesini hafif ışıt
  useMemo(() => {
    cloned.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const mats = Array.isArray(m.material) ? m.material : [m.material]
      for (const mat of mats) {
        const sm = mat as THREE.MeshStandardMaterial
        if (night) { if (sm.map) sm.emissiveMap = sm.map; sm.emissive = new THREE.Color('#ffe9b0'); sm.emissiveIntensity = 0.35 }
        else sm.emissiveIntensity = 0
        sm.needsUpdate = true
      }
    })
  }, [cloned, night])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * spec.speed * spec.dir + spec.phase
    const x = spec.cx + Math.cos(t) * spec.rx
    const z = spec.cz + Math.sin(t) * spec.rz

    // teğet yön (türev)
    const tx = -Math.sin(t) * spec.rx * spec.dir
    const tz =  Math.cos(t) * spec.rz * spec.dir
    const heading = Math.atan2(tx, tz)

    // dalgada hafif sallanma
    const bob  = Math.sin(clock.getElapsedTime() * 1.2 + spec.phase) * spec.bob
    const roll = Math.sin(clock.getElapsedTime() * 0.9 + spec.phase) * 0.04

    ref.current.position.set(x, bob - 0.5, z)
    ref.current.rotation.set(roll, heading, roll * 0.5)
  })

  // gemi boyutuyla orantılı fener yüksekliği
  const h = spec.scale * 0.9
  return (
    <group ref={ref}>
      <primitive object={cloned} scale={spec.scale} />
      {night && (
        <>
          {/* direk feneri (beyaz) */}
          <mesh position={[0, h + 2, 0]}>
            <sphereGeometry args={[0.5, 8, 8]} />
            <meshStandardMaterial color="#fff" emissive="#ffffff" emissiveIntensity={2} />
          </mesh>
          {/* iskele (kırmızı) / sancak (yeşil) */}
          <mesh position={[-spec.scale * 0.5, h, 0]}>
            <sphereGeometry args={[0.4, 8, 8]} />
            <meshStandardMaterial color="#f33" emissive="#ff2200" emissiveIntensity={2} />
          </mesh>
          <mesh position={[spec.scale * 0.5, h, 0]}>
            <sphereGeometry args={[0.4, 8, 8]} />
            <meshStandardMaterial color="#3f3" emissive="#22ff00" emissiveIntensity={2} />
          </mesh>
        </>
      )}
    </group>
  )
}

export default function Ships({ night = false }: { night?: boolean }) {
  return (
    <>
      {VESSELS.map((v, i) => <Vessel key={i} spec={v} night={night} />)}
    </>
  )
}
