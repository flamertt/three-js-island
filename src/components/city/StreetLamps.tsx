import { useMemo } from 'react'
import { ROAD_WIDTHS } from '../../constants/cityLayout'
import type { RoadSegment } from '../../types/osm'

interface Props { roads: RoadSegment[] }

const RENDERED = new Set(['primary', 'secondary', 'tertiary'])
const SPACING = 24       // lamba aralığı (birim)
const MAX_LAMPS = 260

interface Lamp { x: number; z: number; rot: number }

// Yol kenarına dizilen sokak lambaları (yol koridoru içi modeller)
export default function StreetLamps({ roads }: Props) {
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
          {/* lamba başı (parlak) */}
          <mesh position={[0, 4.25, 1.4]}>
            <boxGeometry args={[0.5, 0.25, 0.5]} />
            <meshStandardMaterial color="#fff4c2" emissive="#ffdd66" emissiveIntensity={0.9} />
          </mesh>
        </group>
      ))}
    </>
  )
}
