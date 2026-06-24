import { useMemo, useEffect } from 'react'
import * as THREE from 'three'
import type { RoadSegment } from '../../types/osm'
import { ROAD_WIDTHS } from '../../constants/cityLayout'

interface Props {
  roads: RoadSegment[]
}

const MAIN_ROAD_TYPES = new Set(['primary', 'secondary', 'tertiary'])

// Bir yol polylinesı için miter köşeli kesintisiz şerit geometrisi üret.
// halfOf: yol tipine göre yarı-genişlik; y: yükseklik; roadYBump: çakışan
// farklı yolları y'de ayırmak için kademe.
function buildRibbon(
  roads: RoadSegment[],
  halfOf: (type: string) => number,
  y: number,
  bumpStep: number,
): THREE.BufferGeometry {
  const pos: number[] = []
  const idx: number[] = []
  let base = 0
  let roadIdx = 0

  for (const road of roads) {
    if (!MAIN_ROAD_TYPES.has(road.type)) continue
    const pts = road.points
    if (pts.length < 2) continue
    const half = halfOf(road.type)
    const yy = y + (roadIdx % 6) * bumpStep
    roadIdx++

    const segDir = (i: number): [number, number] => {
      const [x1, z1] = pts[i], [x2, z2] = pts[i + 1]
      const dx = x2 - x1, dz = z2 - z1
      const l = Math.hypot(dx, dz) || 1
      return [dx / l, dz / l]
    }

    const verts: [number, number][] = []
    for (let i = 0; i < pts.length; i++) {
      const dPrev = i > 0 ? segDir(i - 1) : null
      const dNext = i < pts.length - 1 ? segDir(i) : null
      const nPrev = dPrev ? [-dPrev[1], dPrev[0]] as [number, number] : null
      const nNext = dNext ? [-dNext[1], dNext[0]] as [number, number] : null
      let nx: number, nz: number, scale = 1
      if (nPrev && nNext) {
        let mx = nPrev[0] + nNext[0], mz = nPrev[1] + nNext[1]
        const ml = Math.hypot(mx, mz) || 1
        mx /= ml; mz /= ml
        const d = Math.max(mx * nNext[0] + mz * nNext[1], 0.35)
        nx = mx; nz = mz; scale = 1 / d
      } else {
        const n = (nPrev ?? nNext)!
        nx = n[0]; nz = n[1]
      }
      const [px, pz] = pts[i]
      const off = half * scale
      verts.push([px + nx * off, pz + nz * off])  // sol
      verts.push([px - nx * off, pz - nz * off])  // sağ
    }
    for (const [vx, vz] of verts) pos.push(vx, yy, vz)
    for (let i = 0; i < pts.length - 1; i++) {
      const a = base + i * 2
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
    base += pts.length * 2
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

// ─── Otomatik kavşak/viraj yamaları ──────────────────────────────────────────
// Bir yolun ucu başka bir yola değiyorsa (çapraz/T/Y birleşme) oraya yuvarlak
// asfalt disk koyar → sert köşe/boşluk yerine yumuşak kavşak.
function buildJunctions(roads: RoadSegment[]): THREE.BufferGeometry | null {
  const main = roads.filter((r) => MAIN_ROAD_TYPES.has(r.type) && r.points.length >= 2)
  const halfOf = (t: string) => (ROAD_WIDTHS[t] ?? 3.2) / 2

  // Segment uzamsal ızgarası (hızlı yakınlık sorgusu)
  const CELL = 12
  type S = { x1: number; z1: number; x2: number; z2: number; rid: string; half: number }
  const grid = new Map<string, S[]>()
  const gk = (x: number, z: number) => `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`
  for (const r of main) {
    const half = halfOf(r.type)
    for (let i = 0; i < r.points.length - 1; i++) {
      const s: S = { x1: r.points[i][0], z1: r.points[i][1], x2: r.points[i + 1][0], z2: r.points[i + 1][1], rid: r.id, half }
      for (const k of new Set([gk(s.x1, s.z1), gk(s.x2, s.z2)])) {
        if (!grid.has(k)) grid.set(k, [])
        grid.get(k)!.push(s)
      }
    }
  }

  const distSeg = (px: number, pz: number, s: S) => {
    const dx = s.x2 - s.x1, dz = s.z2 - s.z1
    const len2 = dx * dx + dz * dz || 1e-6
    let t = ((px - s.x1) * dx + (pz - s.z1) * dz) / len2
    t = Math.max(0, Math.min(1, t))
    return Math.hypot(px - (s.x1 + dx * t), pz - (s.z1 + dz * t))
  }

  // Her yolun UÇLARINI aday al; başka bir yola değiyorsa kavşak
  // r: yarıçap (= yol yarı-genişliği → eşit kalınlık)
  // sweep: dolacak yay açısı (bağlanma açısına göre)
  const ANGLE_MIN = 15 * Math.PI / 180   // bundan düz birleşmeler → sade dolgu
  const patches: { x: number; z: number; r: number }[] = []
  for (const r of main) {
    const myHalf = halfOf(r.type)
    for (let e = 0; e < 2; e++) {
      const isStart = e === 0
      const end = isStart ? r.points[0] : r.points[r.points.length - 1]
      // ucun yol yönü (içeriden uca doğru)
      const inner = isStart ? r.points[1] : r.points[r.points.length - 2]
      const edx = end[0] - inner[0], edz = end[1] - inner[1]
      const edl = Math.hypot(edx, edz) || 1
      const eux = edx / edl, euz = edz / edl

      const [px, pz] = end
      const cgx = Math.floor(px / CELL), cgz = Math.floor(pz / CELL)
      let hit: S | null = null
      let bestD = Infinity
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        const bucket = grid.get(`${cgx + dx},${cgz + dz}`)
        if (!bucket) continue
        for (const s of bucket) {
          if (s.rid === r.id) continue
          const d = distSeg(px, pz, s)
          if (d < bestD) { bestD = d; hit = s }
        }
      }
      if (!hit || bestD >= Math.max(myHalf, hit.half) + 1.5) continue

      // bağlanma açısı: ucun yönü ile hedef yol yönü arasındaki sapma
      const hdx = hit.x2 - hit.x1, hdz = hit.z2 - hit.z1
      const hl = Math.hypot(hdx, hdz) || 1
      const dot = (eux * hdx + euz * hdz) / hl
      const acute = Math.acos(Math.min(1, Math.abs(dot)))   // 0=paralel, π/2=dik
      const base = Math.max(myHalf, hit.half)               // EŞİT kalınlık

      // Açıya göre yarıçap: neredeyse aynı doğrultu → sade küçük dolgu,
      // açı belirginleştikçe (→ dik) tam yarı-genişlik yuvarlatma.
      const t = Math.min(1, acute / (Math.PI / 2))          // 0..1
      const rad = acute < ANGLE_MIN ? base * 0.7 : base * (0.8 + 0.2 * t)
      patches.push({ x: px, z: pz, r: rad })
    }
  }

  if (patches.length === 0) return null
  const geos: THREE.BufferGeometry[] = []
  for (const p of patches) {
    const g = new THREE.CircleGeometry(p.r, 16)
    g.rotateX(-Math.PI / 2)
    g.translate(p.x, 0.2, p.z)
    geos.push(g)
  }
  // tek geometriye birleştir
  const merged = mergeSimple(geos)
  geos.forEach((g) => g.dispose())
  return merged
}

// Basit geometri birleştirme (sadece position) — discler için yeterli
function mergeSimple(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const pos: number[] = []
  const idx: number[] = []
  let base = 0
  for (const g of geos) {
    const p = g.getAttribute('position')
    for (let i = 0; i < p.count; i++) pos.push(p.getX(i), p.getY(i), p.getZ(i))
    const gi = g.getIndex()
    if (gi) for (let i = 0; i < gi.count; i++) idx.push(base + gi.getX(i))
    base += p.count
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  out.setIndex(idx)
  out.computeVertexNormals()
  return out
}

// Yol = düz asfalt şerit + ince orta şerit çizgisi (renk paleti yok)
export default function OsmRoadNetwork({ roads }: Props) {
  const roadGeo = useMemo(
    () => buildRibbon(roads, (t) => (ROAD_WIDTHS[t] ?? 3.2) / 2, 0.12, 0.01),
    [roads],
  )
  const lineGeo = useMemo(
    () => buildRibbon(roads, () => 0.16, 0.14, 0.01),
    [roads],
  )
  const junctionGeo = useMemo(() => buildJunctions(roads), [roads])

  const roadMat = useMemo(
    () => new THREE.MeshLambertMaterial({ color: '#41454c', side: THREE.DoubleSide }),
    [],
  )
  const lineMat = useMemo(
    () => new THREE.MeshLambertMaterial({ color: '#e8dca0', side: THREE.DoubleSide }),
    [],
  )

  useEffect(() => () => {
    roadGeo.dispose(); lineGeo.dispose(); junctionGeo?.dispose()
  }, [roadGeo, lineGeo, junctionGeo])

  return (
    <>
      <mesh geometry={roadGeo} material={roadMat} receiveShadow />
      {junctionGeo && <mesh geometry={junctionGeo} material={roadMat} receiveShadow />}
      <mesh geometry={lineGeo} material={lineMat} />
    </>
  )
}
