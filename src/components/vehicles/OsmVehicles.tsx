import { useMemo } from 'react'
import NetworkVehicle, {
  type VehicleNet, type VehicleInit, type RoadNode,
} from './NetworkVehicle'
import { VEHICLE_MODELS, EMERGENCY_MODELS, ROAD_WIDTHS } from '../../constants/cityLayout'
import { seededRng, pickRandom } from '../../utils/seededRng'
import type { CityData } from '../../types/osm'

interface Props { cityData: CityData; night?: boolean }

const VEHICLE_ROAD_TYPES = ['primary', 'secondary', 'tertiary']
const SPEEDS: Record<string, number> = { primary: 7, secondary: 5, tertiary: 4 }
const MAX_VEHICLES = 60
const MIN_ROAD_LEN = 12

export default function OsmVehicles({ cityData, night = false }: Props) {
  const { net, inits } = useMemo(() => {
    const rng = seededRng(1234)
    const isUser = (id: string) => id.startsWith('user-')

    // Sürülebilir yollar (ana yollar + kullanıcı yolları)
    const drivable = cityData.roads.filter(
      (r) => (VEHICLE_ROAD_TYPES.includes(r.type) || isUser(r.id)) && r.points.length >= 2,
    )

    // RoadNode dizisi (kümülatif uzunluklar)
    const roads: RoadNode[] = drivable.map((r) => {
      const pts = r.points as [number, number][]
      const cum = [0]
      for (let i = 1; i < pts.length; i++)
        cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
      return {
        pts, cum, total: cum[cum.length - 1],
        width: ROAD_WIDTHS[r.type] ?? 3.2,
        speed: SPEEDS[r.type] ?? 5,
      }
    })

    // Kavşak düğümleri: uçları aynı noktaya (≈2 birim) denk gelen yollar
    const nodeKey = (x: number, z: number) => `${Math.round(x / 2)},${Math.round(z / 2)}`
    const nodes = new Map<string, { i: number; atStart: boolean }[]>()
    roads.forEach((road, i) => {
      const a = road.pts[0], b = road.pts[road.pts.length - 1]
      for (const [pt, atStart] of [[a, true], [b, false]] as const) {
        const k = nodeKey(pt[0], pt[1])
        if (!nodes.has(k)) nodes.set(k, [])
        nodes.get(k)!.push({ i, atStart })
      }
    })

    const net: VehicleNet = { roads, nodes, nodeKey }

    // Başlangıç araçları: yeterince uzun yollara serp
    const longEnough = roads
      .map((r, i) => ({ i, total: r.total }))
      .filter((r) => r.total >= MIN_ROAD_LEN)
      .sort(() => rng() - 0.5)

    // %12 acil durum aracı (daha hızlı), gerisi normal çeşitlilik
    const mk = (i: number): VehicleInit => {
      const emergency = rng() < 0.12
      return {
        url: emergency ? pickRandom(EMERGENCY_MODELS, rng) : pickRandom(VEHICLE_MODELS, rng),
        roadIdx: i, dir: rng() < 0.5 ? 1 : -1, t: rng(),
        speedMul: emergency ? 1.5 : 1,
      }
    }
    const inits: VehicleInit[] = []
    for (const { i } of longEnough) {
      if (inits.length >= MAX_VEHICLES) break
      inits.push(mk(i))
      if (inits.length < MAX_VEHICLES && rng() < 0.5) inits.push(mk(i))
    }

    return { net, inits }
  }, [cityData])

  return (
    <>
      {inits.map((init, i) => <NetworkVehicle key={i} net={net} init={init} night={night} />)}
    </>
  )
}
