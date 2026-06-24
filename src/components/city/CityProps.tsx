import { useMemo } from 'react'
import Model from '../shared/Model'
import {
  treeOak, treeDefault, treeDetailed, treeFat, treePineTall,
  bushA, bushLarge, bushSmall, flowerRed, flowerYellow, flowerPurple,
  grassLeafs, rockSmall,
} from '../../assets/models'
import { seededRng, pickRandom } from '../../utils/seededRng'
import { islandRadius, ISLAND_MAX_R, HELIPAD_RADIUS, FARM_CENTER, FARM_RADIUS } from '../../constants/cityLayout'
import type { CityData } from '../../types/osm'

interface Props { cityData: CityData }

// Yeşillendirme paleti (nature-kit modelleri ~1.5 birim → büyük ölçek gerekir)
const TREES  = [
  { url: treeOak, s: 6.0 }, { url: treeDefault, s: 5.5 }, { url: treeDetailed, s: 6.0 },
  { url: treeFat, s: 5.5 }, { url: treePineTall, s: 6.5 },
]
const SHRUBS = [
  { url: bushA, s: 4.0 }, { url: bushLarge, s: 4.8 }, { url: bushSmall, s: 3.2 },
  { url: grassLeafs, s: 3.5 },
]
const FLOWERS = [
  { url: flowerRed, s: 4.0 }, { url: flowerYellow, s: 4.0 }, { url: flowerPurple, s: 4.0 },
  { url: rockSmall, s: 4.0 },
]

const CELL = 9
const COAST_MARGIN = 6      // çim kıyısından içeri küçük pay (kumsal zaten dışarıda)
const TREE_CHANCE = 0.7     // boş yeşil hücrelerin %70'ine bitki

interface Placement { url: string; x: number; z: number; scale: number; rot: number }

export default function CityProps({ cityData }: Props) {
  const greens = useMemo<Placement[]>(() => {
    const rng = seededRng(98765)
    const occupied = new Set<string>()
    const key = (gx: number, gz: number) => `${gx},${gz}`

    // Binalar + 3×3 komşuluk → dolu
    for (const b of cityData.buildings) {
      const gx = Math.floor(b.center[0] / CELL)
      const gz = Math.floor(b.center[1] / CELL)
      for (let dx = -1; dx <= 1; dx++)
        for (let dz = -1; dz <= 1; dz++)
          occupied.add(key(gx + dx, gz + dz))
    }
    // Yol noktaları → sadece o hücre dolu; segment arası örneklenir
    for (const r of cityData.roads) {
      for (let i = 0; i < r.points.length - 1; i++) {
        const [x1, z1] = r.points[i]
        const [x2, z2] = r.points[i + 1]
        const dx = x2 - x1, dz = z2 - z1
        const len = Math.hypot(dx, dz)
        const steps = Math.max(1, Math.ceil(len / (CELL * 0.5)))
        for (let s = 0; s <= steps; s++) {
          const t = s / steps
          occupied.add(key(Math.floor((x1 + dx * t) / CELL), Math.floor((z1 + dz * t) / CELL)))
        }
      }
    }

    // Organik ada içindeki tüm boş çim hücrelerine yeşillik (kıyıya kadar)
    const g = Math.ceil(ISLAND_MAX_R / CELL)
    const greens: Placement[] = []
    for (let gx = -g; gx <= g; gx++) {
      for (let gz = -g; gz <= g; gz++) {
        if (occupied.has(key(gx, gz))) continue
        const cx = gx * CELL + CELL / 2
        const cz = gz * CELL + CELL / 2
        // çim bölgesinin içinde mi? (çim kıyısına kadar; kumsal dışarıda)
        const d = Math.hypot(cx, cz)
        const theta = Math.atan2(cz, cx)
        if (d > islandRadius(theta) - COAST_MARGIN) continue
        if (d < HELIPAD_RADIUS) continue   // merkez pist bölgesi boş kalsın
        if (Math.hypot(cx - FARM_CENTER[0], cz - FARM_CENTER[1]) < FARM_RADIUS) continue
        if (rng() > TREE_CHANCE) continue

        const roll = rng()
        const pal = roll < 0.65 ? TREES : roll < 0.85 ? SHRUBS : FLOWERS
        const m = pickRandom(pal, rng)
        greens.push({
          url: m.url,
          x: cx + (rng() - 0.5) * 4,
          z: cz + (rng() - 0.5) * 4,
          scale: m.s * (0.85 + rng() * 0.4),
          rot: rng() * Math.PI * 2,
        })
      }
    }

    return greens
  }, [cityData])

  return (
    <>
      {greens.map((p, i) => (
        <Model key={`g${i}`} url={p.url} position={[p.x, 0, p.z]} rotation={[0, p.rot, 0]} scale={p.scale} />
      ))}
    </>
  )
}
