import type { GeoJSONCollection } from '../types/geojson'
import type { CityData, RoadSegment, BuildingEntity, WaterPolygon } from '../types/osm'
import { CITY_BBOX, type BBox } from './overpass'
import {
  CITY_RADIUS, RING_RADIUS, ROAD_WIDTHS, HELIPAD_RADIUS, FARM_CENTER, FARM_RADIUS,
  buildingScale, buildingFootprintRadius,
} from '../constants/cityLayout'

// ─── Coordinate projection (şehre göre) ──────────────────────────────────────
const M_PER_LAT = 111_100
const SCALE = 0.062  // scene units / meter  →  ~280×340 scene unit city
function makeProjection(bbox: BBox) {
  const latC = (bbox.south + bbox.north) / 2
  const lonC = (bbox.west + bbox.east) / 2
  const mPerLon = Math.cos((latC * Math.PI) / 180) * 111_100
  return {
    lonToX: (lon: number) =>  (lon - lonC) * mPerLon * SCALE,
    latToZ: (lat: number) => -(lat - latC) * M_PER_LAT * SCALE,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function centroid(pts: [number, number][]): [number, number] {
  return [
    pts.reduce((s, p) => s + p[0], 0) / pts.length,
    pts.reduce((s, p) => s + p[1], 0) / pts.length,
  ]
}

function shoelaceArea(pts: [number, number][]): number {
  let a = 0
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length
    a += pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1]
  }
  return Math.abs(a) / 2
}

function defaultLanes(type: string): number {
  return type === 'primary' || type === 'secondary' ? 2 : 1
}

// ─── Ayak-izi farkında aralık filtresi (iç içe geçmeyi önler) ────────────────
// Her binanın gerçek ayak-izi yarıçapına göre; iki bina rA+rB+gap'ten yakınsa
// küçüğü elenir. Büyük binalar önce, grid ile O(n).
function filterByFootprint(buildings: BuildingEntity[], maxCount: number, gap = 1.0): BuildingEntity[] {
  const withR = buildings.map((b) => ({
    b,
    r: buildingFootprintRadius(buildingScale(b.area, b.levels, b.id, b.tags.building ?? '').scale),
  }))
  withR.sort((a, z) => z.r - a.r)   // büyük ayak-izi önce

  const CELL = 12
  const grid = new Map<string, { x: number; z: number; r: number }[]>()
  const gk = (x: number, z: number) => `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`
  const kept: BuildingEntity[] = []

  for (const { b, r } of withR) {
    if (kept.length >= maxCount) break
    const [cx, cz] = b.center
    const gx = Math.floor(cx / CELL), gz = Math.floor(cz / CELL)
    let clash = false
    outer: for (let dx = -1; dx <= 1 && !clash; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const bucket = grid.get(`${gx + dx},${gz + dz}`)
        if (!bucket) continue
        for (const o of bucket) {
          if (Math.hypot(cx - o.x, cz - o.z) < r + o.r + gap) { clash = true; break outer }
        }
      }
    }
    if (clash) continue
    const k = gk(cx, cz)
    if (!grid.has(k)) grid.set(k, [])
    grid.get(k)!.push({ x: cx, z: cz, r })
    kept.push(b)
  }
  return kept
}

// ─── Bina-bina ayırma (iç içe geçenleri ittele) ──────────────────────────────
// pushOffRoads yoldan kaçarken binaları üst üste itebilir. Birkaç gevşeme
// geçişiyle, ayak-izleri çakışan çiftleri normal yönde aralarına boşluk açacak
// şekilde iter. Grid ile O(n).
function separateBuildings(buildings: BuildingEntity[], gap = 0.8, passes = 8): BuildingEntity[] {
  const arr = buildings.map((b) => ({
    b,
    x: b.center[0],
    z: b.center[1],
    r: buildingFootprintRadius(buildingScale(b.area, b.levels, b.id, b.tags.building ?? '').scale),
  }))
  const CELL = 16
  for (let pass = 0; pass < passes; pass++) {
    const grid = new Map<string, number[]>()
    const gk = (x: number, z: number) => `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`
    arr.forEach((a, i) => {
      const k = gk(a.x, a.z)
      if (!grid.has(k)) grid.set(k, [])
      grid.get(k)!.push(i)
    })
    let moved = false
    for (let i = 0; i < arr.length; i++) {
      const a = arr[i]
      const gx = Math.floor(a.x / CELL), gz = Math.floor(a.z / CELL)
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        const bucket = grid.get(`${gx + dx},${gz + dz}`)
        if (!bucket) continue
        for (const j of bucket) {
          if (j <= i) continue
          const c = arr[j]
          let nx = a.x - c.x, nz = a.z - c.z
          let d = Math.hypot(nx, nz)
          const minD = a.r + c.r + gap
          if (d < minD) {
            if (d < 1e-3) { nx = Math.cos(i * 2.4); nz = Math.sin(i * 2.4); d = 1 }
            else { nx /= d; nz /= d }
            const push = (minD - d) / 2
            a.x += nx * push; a.z += nz * push
            c.x -= nx * push; c.z -= nz * push
            moved = true
          }
        }
      }
    }
    // şehir içinde / pist-tarla dışında tut
    for (const a of arr) {
      const dc = Math.hypot(a.x, a.z)
      if (dc > CITY_RADIUS) { a.x = (a.x / dc) * CITY_RADIUS; a.z = (a.z / dc) * CITY_RADIUS }
    }
    if (!moved) break
  }
  return arr.map((a) =>
    a.x === a.b.center[0] && a.z === a.b.center[1]
      ? a.b : { ...a.b, center: [a.x, a.z] as [number, number] },
  )
}

const dist2 = (x: number, z: number) => x * x + z * z

// ─── Polyline'ı daireye kırp ──────────────────────────────────────────────────
// R yarıçaplı dairenin DIŞINDA kalan kısımları atar, sınırda kesişim noktası ekler.
// Bir yol birden çok iç parçaya bölünebilir.
function clipPolylineToCircle(pts: [number, number][], R: number): [number, number][][] {
  const R2 = R * R
  const inside = (p: [number, number]) => dist2(p[0], p[1]) <= R2

  // Segment-daire kesişimi: A içeride/dışarıda B ile arası, daire üstündeki nokta
  function boundary(a: [number, number], b: [number, number]): [number, number] {
    const dx = b[0] - a[0], dz = b[1] - a[1]
    const A = dx * dx + dz * dz
    const B = 2 * (a[0] * dx + a[1] * dz)
    const C = dist2(a[0], a[1]) - R2
    const disc = Math.max(B * B - 4 * A * C, 0)
    // [0,1] aralığındaki kökü seç
    const t1 = (-B + Math.sqrt(disc)) / (2 * A)
    const t2 = (-B - Math.sqrt(disc)) / (2 * A)
    const t = [t1, t2].filter((v) => v >= 0 && v <= 1).sort((u, v) => u - v)[0] ?? 0
    return [a[0] + dx * t, a[1] + dz * t]
  }

  const runs: [number, number][][] = []
  let cur: [number, number][] = []

  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]
    const pin = inside(p)
    if (pin) {
      if (cur.length === 0 && i > 0) cur.push(boundary(p, pts[i - 1]))
      cur.push(p)
    } else {
      if (cur.length > 0) {
        cur.push(boundary(cur[cur.length - 1], p))
        runs.push(cur)
        cur = []
      }
    }
  }
  if (cur.length >= 2) runs.push(cur)
  return runs.filter((r) => r.length >= 2)
}

// ─── Çevre yolu (daire) ───────────────────────────────────────────────────────
function makeRingRoad(): RoadSegment {
  const N = 144   // sık → düz daireye yakın, uçlarla boşluk kalmaz
  const points: [number, number][] = []
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2
    points.push([Math.cos(a) * RING_RADIUS, Math.sin(a) * RING_RADIUS])
  }
  return { id: 'ring', points, type: 'secondary', lanes: 2 }
}

// Görünen (çizilen) yol tipleri
const RENDERED = new Set(['primary', 'secondary', 'tertiary'])

// ─── Yol segmentleri (taşma itme için) ───────────────────────────────────────
interface Seg { x1: number; z1: number; x2: number; z2: number; half: number }

function collectSegments(roads: RoadSegment[]): Seg[] {
  const segs: Seg[] = []
  for (const r of roads) {
    if (!RENDERED.has(r.type)) continue   // sadece görünür yollar önemli
    const half = (ROAD_WIDTHS[r.type] ?? 3.2) / 2
    for (let i = 0; i < r.points.length - 1; i++) {
      const [x1, z1] = r.points[i]
      const [x2, z2] = r.points[i + 1]
      if (dist2(x2 - x1, z2 - z1) < 0.04) continue
      segs.push({ x1, z1, x2, z2, half })
    }
  }
  return segs
}

// Noktanın segmente en yakın ayağı + uzaklık
function closestOnSeg(cx: number, cz: number, s: Seg) {
  const dx = s.x2 - s.x1, dz = s.z2 - s.z1
  const len2 = dx * dx + dz * dz || 1e-6
  let t = ((cx - s.x1) * dx + (cz - s.z1) * dz) / len2
  t = Math.max(0, Math.min(1, t))
  const fx = s.x1 + dx * t, fz = s.z1 + dz * t
  return { fx, fz, d: Math.hypot(cx - fx, cz - fz) }
}

// En yakın yol yön açısı (bina hizalaması)
function nearestRoadAngle(cx: number, cz: number, segs: Seg[]): number {
  let bestD = Infinity, ang = 0
  for (const s of segs) {
    const { d } = closestOnSeg(cx, cz, s)
    if (d * d < bestD) { bestD = d * d; ang = Math.atan2(s.x2 - s.x1, s.z2 - s.z1) }
  }
  return ang
}

// Binaları yola taşmayacak şekilde SİLMEDEN ittele. Her bina için gereken
// açıklık = yol yarı-genişliği + bina ayak-izi yarıçapı + pay. Birkaç geçişle
// (bir yoldan kaçarken başka yola girmesin) dik yönde dışarı kaydır.
const PUSH_MARGIN = 1.2
const PUSH_PASSES = 4
function pushOffRoads(buildings: BuildingEntity[], segs: Seg[]): BuildingEntity[] {
  return buildings.map((b) => {
    const { scale } = buildingScale(b.area, b.levels, b.id, b.tags.building ?? '')
    const footR = buildingFootprintRadius(scale)
    let cx = b.center[0], cz = b.center[1]

    for (let pass = 0; pass < PUSH_PASSES; pass++) {
      // en derin ihlali bul
      let worst: { s: Seg; fx: number; fz: number; d: number; need: number } | null = null
      for (const s of segs) {
        const { fx, fz, d } = closestOnSeg(cx, cz, s)
        const need = s.half + footR + PUSH_MARGIN
        if (d < need && (!worst || need - d > worst.need - worst.d)) {
          worst = { s, fx, fz, d, need }
        }
      }
      if (!worst) break
      // yoldan dışa doğru normal (ayaktan binaya). Üst üste ise segment dikini al
      let nx = cx - worst.fx, nz = cz - worst.fz
      let nl = Math.hypot(nx, nz)
      if (nl < 1e-3) {
        const dx = worst.s.x2 - worst.s.x1, dz = worst.s.z2 - worst.s.z1
        const dl = Math.hypot(dx, dz) || 1
        nx = -dz / dl; nz = dx / dl; nl = 1
      } else { nx /= nl; nz /= nl }
      // gereken uzaklığa taşı
      cx = worst.fx + nx * worst.need
      cz = worst.fz + nz * worst.need
      // şehir içinde tut
      const dc = Math.hypot(cx, cz)
      if (dc > CITY_RADIUS) { cx = (cx / dc) * CITY_RADIUS; cz = (cz / dc) * CITY_RADIUS }
    }

    return cx === b.center[0] && cz === b.center[1]
      ? b : { ...b, center: [cx, cz] as [number, number] }
  })
}

// ─── Direct GeoJSON parser ────────────────────────────────────────────────────
export function parseCityData(geojson: GeoJSONCollection, bbox: BBox = CITY_BBOX): CityData {
  const { lonToX, latToZ } = makeProjection(bbox)
  const roads: RoadSegment[] = []
  const rawBuildings: BuildingEntity[] = []
  const water: WaterPolygon[] = []

  let idCounter = 0

  for (const feature of geojson.features) {
    const p    = feature.properties
    const geom = feature.geometry

    if (geom.type === 'LineString' && p.highway) {
      const points = geom.coordinates.map(
        ([lon, lat]) => [lonToX(lon), latToZ(lat)] as [number, number],
      )
      if (points.length < 2) continue
      // Daireye kırp → şehir sınırı dışına taşan yol kısımları atılır
      for (const run of clipPolylineToCircle(points, RING_RADIUS)) {
        roads.push({
          id: `r${idCounter++}`,
          points: run,
          type: p.highway,
          lanes: Number(p.lanes) || defaultLanes(p.highway),
        })
      }

    } else if (geom.type === 'Polygon' && p.building) {
      const ring = geom.coordinates[0]
      if (!ring || ring.length < 3) continue
      const pts = ring.map(([lon, lat]) => [lonToX(lon), latToZ(lat)] as [number, number])
      rawBuildings.push({
        id: idCounter++,
        center: centroid(pts),
        area: shoelaceArea(pts),
        // GeoJSON'daki 'levels' field'ını direkt oku
        levels: Number(p.levels) || 1,
        tags: {
          building: p.building ?? 'yes',
          amenity:  p.amenity ?? '',
        },
      })

    } else if (geom.type === 'Polygon' && p.water) {
      const ring = geom.coordinates[0]
      if (!ring || ring.length < 2) continue
      const pts = ring.map(([lon, lat]) => [lonToX(lon), latToZ(lat)] as [number, number])
      water.push({ id: idCounter++, points: pts })
    }
  }

  // Çevre yolu dairesini ekle. Açık uçların bağlanması elle editörde yapılıyor,
  // otomatik uç-bağlama kaldırıldı.
  roads.push(makeRingRoad())

  // Yuvarlak şehir: daire dışı + merkez pist + tarla bölgesindeki binaları ele
  const inCircle = rawBuildings.filter((b) => {
    const dc = dist2(b.center[0], b.center[1])
    const df = dist2(b.center[0] - FARM_CENTER[0], b.center[1] - FARM_CENTER[1])
    return dc <= CITY_RADIUS * CITY_RADIUS
        && dc >= HELIPAD_RADIUS * HELIPAD_RADIUS
        && df >= FARM_RADIUS * FARM_RADIUS
  })
  // Önce aralık filtresiyle ≤700'e indir, SONRA itele/hizala → çok daha hızlı
  // (binlerce bina yerine 700 üzerinde O(n×seg) çalışır).
  const segs    = collectSegments(roads)
  const spaced  = filterByFootprint(inCircle, 700, 1.0)
  // Yoldan-itme ve bina-bina ayırmayı dönüşümlü uygula: ikisi de sağlanana yaklaş
  let placed = pushOffRoads(spaced, segs)
  placed = separateBuildings(placed, 0.8, 6)
  placed = pushOffRoads(placed, segs)
  placed = separateBuildings(placed, 0.8, 4)
  placed = pushOffRoads(placed, segs)   // SON işlem yol-itme → yola taşma kalmaz
  const buildings = placed.map((b) => ({
    ...b,
    rot: nearestRoadAngle(b.center[0], b.center[1], segs),
  }))

  const allX = roads.flatMap((r) => r.points.map((p) => p[0]))
  const allZ = roads.flatMap((r) => r.points.map((p) => p[1]))

  return {
    roads,
    buildings,
    water,
    bounds: {
      minX: allX.length ? Math.min(...allX) : -150,
      maxX: allX.length ? Math.max(...allX) :  150,
      minZ: allZ.length ? Math.min(...allZ) : -180,
      maxZ: allZ.length ? Math.max(...allZ) :  180,
    },
  }
}
