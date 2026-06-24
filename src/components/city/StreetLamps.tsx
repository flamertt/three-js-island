import { useMemo } from 'react'
import * as THREE from 'three'
import { ROAD_WIDTHS } from '../../constants/cityLayout'
import type { RoadSegment } from '../../types/osm'

interface Props { roads: RoadSegment[]; night?: boolean }

// Sıcak, yumuşak kenarlı ışık havuzu dokusu (radyal gradyan) — bir kez üret.
function makeGlowTexture(): THREE.CanvasTexture {
  const s = 128
  const c = document.createElement('canvas')
  c.width = c.height = s
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  g.addColorStop(0, 'rgba(255,224,150,0.95)')
  g.addColorStop(0.4, 'rgba(255,210,120,0.45)')
  g.addColorStop(1, 'rgba(255,200,100,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, s, s)
  return new THREE.CanvasTexture(c)
}

const RENDERED = new Set(['primary', 'secondary', 'tertiary'])
const SPACING = 24       // lamba aralığı (birim)
const MAX_LAMPS = 260

interface Lamp { x: number; z: number; rot: number }

// Yol kenarına dizilen sokak lambaları (yol koridoru içi modeller)
export default function StreetLamps({ roads, night = false }: Props) {
  const glowTex = useMemo(() => makeGlowTexture(), [])
  const glowMat = useMemo(
    () => new THREE.MeshBasicMaterial({
      map: glowTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
    [glowTex],
  )
  const lamps = useMemo<Lamp[]>(() => {
    const out: Lamp[] = []
    let side = 1
    for (const r of roads) {
      if (!RENDERED.has(r.type)) continue
      const off = (ROAD_WIDTHS[r.type] ?? 3.2) / 2 + 1.4
      for (let i = 0; i < r.points.length - 1; i++) {
        const [x1, z1] = r.points[i]
        const [x2, z2] = r.points[i + 1]
        const dx = x2 - x1, dz = z2 - z1
        const len = Math.hypot(dx, dz)
        if (len < 1) continue
        const ux = dx / len, uz = dz / len
        const px = -uz, pz = ux            // dik (kenar) yön
        const steps = Math.floor(len / SPACING)
        for (let s = 1; s <= steps; s++) {
          if (out.length >= MAX_LAMPS) break
          const t = s * SPACING
          const bx = x1 + ux * t, bz = z1 + uz * t
          side *= -1
          out.push({
            x: bx + px * off * side,
            z: bz + pz * off * side,
            rot: Math.atan2(px * side, pz * side),   // kol yola doğru
          })
        }
      }
    }
    return out
  }, [roads])

  return (
    <>
      {lamps.map((l, i) => (
        <group key={i} position={[l.x, 0, l.z]} rotation={[0, l.rot, 0]}>
          {/* direk */}
          <mesh position={[0, 2.2, 0]} castShadow>
            <cylinderGeometry args={[0.13, 0.16, 4.4, 8]} />
            <meshLambertMaterial color="#3a3d42" />
          </mesh>
          {/* kol */}
          <mesh position={[0, 4.3, 0.7]} castShadow>
            <boxGeometry args={[0.12, 0.12, 1.6]} />
            <meshLambertMaterial color="#3a3d42" />
          </mesh>
          {/* lamba başı (parlak; gece daha yoğun) */}
          <mesh position={[0, 4.25, 1.4]}>
            <boxGeometry args={[0.5, 0.25, 0.5]} />
            <meshStandardMaterial
              color="#fff4c2"
              emissive="#ffdd66"
              emissiveIntensity={night ? 3.2 : 0.9}
              toneMapped={false}
            />
          </mesh>

          {/* gece: yere düşen sıcak ışık havuzu (gerçek ışık değil → performanslı) */}
          {night && (
            <mesh
              position={[0, 0.22, 1.4]}
              rotation={[-Math.PI / 2, 0, 0]}
              material={glowMat}
            >
              <planeGeometry args={[12, 12]} />
            </mesh>
          )}
        </group>
      ))}
    </>
  )
}
