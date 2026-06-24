import { useMemo } from 'react'
import AnimatedPerson, { type PersonSpec } from './AnimatedPerson'
import { charB, charF, charI, charJ, charP, charQ } from '../../assets/models'
import { seededRng, pickRandom } from '../../utils/seededRng'
import { islandRadius, BEACH_WIDTH, HELIPAD_RADIUS, FARM_CENTER, FARM_RADIUS } from '../../constants/cityLayout'
import type { CityData } from '../../types/osm'

interface Props { cityData: CityData }

const PEOPLE = [charB, charF, charI, charJ, charP, charQ]
const BASE_SCALE = 0.45        // ~9 birim model → ~4 birim insan
const MODEL_MINY = -1          // ölçülen taban → footY = +scale
const CELL = 8
const COAST_MARGIN = 8
const MAX_CITY = 70            // şehirdeki kişi
const BEACH_COUNT = 26         // sahildeki kişi
const SPAWN_CHANCE = 0.35

export default function People({ cityData }: Props) {
  const specs = useMemo<PersonSpec[]>(() => {
    const rng = seededRng(54321)
    const occupied = new Set<string>()
    const key = (gx: number, gz: number) => `${gx},${gz}`

    for (const b of cityData.buildings)
      occupied.add(key(Math.floor(b.center[0] / CELL), Math.floor(b.center[1] / CELL)))
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

    const mk = (x: number, z: number, walk: boolean): PersonSpec => {
      const scale = BASE_SCALE * (0.9 + rng() * 0.2)
      return {
        url: pickRandom(PEOPLE, rng),
        x, z,
        rot: rng() * Math.PI * 2,
        scale,
        footY: -MODEL_MINY * scale,       // tabanı yere oturt
        speed: walk ? 1.2 + rng() * 1.3 : 0,
        leash: 12 + rng() * 20,
      }
    }

    const out: PersonSpec[] = []

    // ── Şehir: boş çim hücreleri (çoğu yürür) ──
    const g = Math.ceil(islandRadius(0) / CELL) + 2
    for (let gx = -g; gx <= g && out.length < MAX_CITY; gx++) {
      for (let gz = -g; gz <= g && out.length < MAX_CITY; gz++) {
        if (occupied.has(key(gx, gz))) continue
        const cx = gx * CELL + CELL / 2
        const cz = gz * CELL + CELL / 2
        const d = Math.hypot(cx, cz)
        const theta = Math.atan2(cz, cx)
        if (d > islandRadius(theta) - COAST_MARGIN) continue
        if (d < HELIPAD_RADIUS) continue   // merkez pist bölgesi boş
        if (Math.hypot(cx - FARM_CENTER[0], cz - FARM_CENTER[1]) < FARM_RADIUS) continue
        if (rng() > SPAWN_CHANCE) continue
        out.push(mk(cx + (rng() - 0.5) * 4, cz + (rng() - 0.5) * 4, rng() < 0.7))
      }
    }

    // ── Sahil: çim kıyısı ile kumsal dışı arasındaki kum bandı (çoğu durur) ──
    for (let i = 0; i < BEACH_COUNT; i++) {
      const a = rng() * Math.PI * 2
      const coast = islandRadius(a)
      const r = coast + 3 + rng() * (BEACH_WIDTH - 8)   // kum bandı içinde
      out.push(mk(Math.cos(a) * r, Math.sin(a) * r, rng() < 0.35))
    }

    return out
  }, [cityData])

  return (
    <>
      {specs.map((s, i) => <AnimatedPerson key={i} spec={s} />)}
    </>
  )
}
