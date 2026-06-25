import { Suspense, useState, useMemo, useCallback } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { Sky, OrbitControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'

import Ground from './Ground'
import Ocean from './Ocean'
import Ships from './Ships'
import Harbor from './Harbor'
import Lighting from './Lighting'
import OsmCity from '../city/OsmCity'
import OsmVehicles from '../vehicles/OsmVehicles'
import Helipad from '../city/Helipad'
import HUD from '../ui/HUD'
import LoadingScreen from '../ui/LoadingScreen'
import RoadEditor, { nearestRoadId, type EditTool } from '../editor/RoadEditor'
import EditorPanel from '../editor/EditorPanel'
import { SunIcon, MoonIcon, PencilIcon, PersonIcon } from '../ui/icons'
import Player, { type Obstacle, type Prompt } from '../city/Player'
import HeliController from '../city/HeliController'
import CarController from '../city/CarController'
import { buildingScale } from '../../constants/cityLayout'
import { setHijacked } from '../../utils/traffic'
import { useCityData } from '../../hooks/useCityData'
import { useRoadEdits } from '../../hooks/useRoadEdits'
import type { CityData } from '../../types/osm'
import styles from './CityCanvas.module.css'

// Preload all GLB assets so the browser starts fetching immediately
import {
  skyA, skyB, skyC, skyD, skyE,
  comA, comB, comC, comD, comE, comF,
  subA, subB, subC, subD, subE, subF,
  roadStraight, roadBend, roadIntersect,
  sedan, taxi, police, van, delivery, suv,
  shipCargoA, shipCargoB, shipLiner, shipLinerSm, shipLarge,
  boatTugA, boatSpeedA, boatFishing,
  cargoContA, cargoContB, cargoContC, cargoPileA, cargoPileB, buoy, buoyFlag,
  boatHouseA, boatHouseB, boatRowLarge,
  treeOak, treeDefault, treeDetailed, treeFat, treePineTall,
  bushA, bushLarge, bushSmall, flowerRed, flowerYellow, flowerPurple,
  grassLeafs, rockSmall, statueObelisk,
  charB, charF, charI, charJ, charP, charQ,
  ambulance, firetruck, garbageTruck, truck, raceCar, sedanSports, hatchback, suvLuxury, tractor,
  trainContBlue, trainContGreen, trainContRed,
  cornCrop, wheatCrop, bambooCrop, dirtRow, fenceSimple, fenceCorner, fenceGate,
} from '../../assets/models'

;[
  skyA, skyB, skyC, skyD, skyE,
  comA, comB, comC, comD, comE, comF,
  subA, subB, subC, subD, subE, subF,
  roadStraight, roadBend, roadIntersect,
  sedan, taxi, police, van, delivery, suv,
  shipCargoA, shipCargoB, shipLiner, shipLinerSm, shipLarge,
  boatTugA, boatSpeedA, boatFishing,
  cargoContA, cargoContB, cargoContC, cargoPileA, cargoPileB, buoy, buoyFlag,
  boatHouseA, boatHouseB, boatRowLarge,
  treeOak, treeDefault, treeDetailed, treeFat, treePineTall,
  bushA, bushLarge, bushSmall, flowerRed, flowerYellow, flowerPurple,
  grassLeafs, rockSmall, statueObelisk,
  charB, charF, charI, charJ, charP, charQ,
  ambulance, firetruck, garbageTruck, truck, raceCar, sedanSports, hatchback, suvLuxury, tractor,
  trainContBlue, trainContGreen, trainContRed,
  cornCrop, wheatCrop, bambooCrop, dirtRow, fenceSimple, fenceCorner, fenceGate,
].forEach((url) => useGLTF.preload(url))

function Fallback() {
  return null
}

// Kamera hedefini şehir sınırlarıyla sınırla → sonsuz gezme yok
function CameraRig() {
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3 } | null
  useFrame(() => {
    if (!controls?.target) return
    const tg = controls.target
    tg.x = THREE.MathUtils.clamp(tg.x, -260, 260)
    tg.z = THREE.MathUtils.clamp(tg.z, -240, 240)
    tg.y = THREE.MathUtils.clamp(tg.y, 0, 30)
  })
  return null
}

export default function CityCanvas() {
  const { cityData, status, error } = useCityData()
  const { removed, added, removeRoad, addRoad, undoAdd, restoreRemoved, resetAll } = useRoadEdits()

  const [editOpen, setEditOpen] = useState(false)
  const [tool, setTool] = useState<EditTool>('delete')
  const [draft, setDraft] = useState<[number, number][]>([])
  const [night, setNight] = useState(false)
  // 'off' serbest kamera · 'foot' yaya · 'heli' helikopter · 'car' araba
  const [mode, setMode] = useState<'off' | 'foot' | 'heli' | 'car'>('off')
  const [spawn, setSpawn] = useState<[number, number]>([0, 50])
  const [prompt, setPrompt] = useState<Prompt>(null)
  const [car, setCar] = useState<{ x: number; z: number; rot: number; url: string }>({ x: 0, z: 0, rot: 0, url: '' })

  // Temel yolların segmentleri (kullanıcı yollarının kalınlığını eşlemek için)
  const baseSegs = useMemo(() => {
    const segs: { x1: number; z1: number; x2: number; z2: number; type: string }[] = []
    if (!cityData) return segs
    for (const r of cityData.roads) {
      for (let i = 0; i < r.points.length - 1; i++) {
        const [x1, z1] = r.points[i]
        const [x2, z2] = r.points[i + 1]
        segs.push({ x1, z1, x2, z2, type: r.type })
      }
    }
    return segs
  }, [cityData])

  // Bir noktaya en yakın temel yol segmenti: tip + segment üstündeki en yakın nokta
  const nearestOnRoads = useCallback((px: number, pz: number) => {
    let best = Infinity, type: string | null = null, sx = px, sz = pz
    for (const s of baseSegs) {
      const dx = s.x2 - s.x1, dz = s.z2 - s.z1
      const len2 = dx * dx + dz * dz || 1e-6
      let t = ((px - s.x1) * dx + (pz - s.z1) * dz) / len2
      t = Math.max(0, Math.min(1, t))
      const fx = s.x1 + dx * t, fz = s.z1 + dz * t
      const d = Math.hypot(px - fx, pz - fz)
      if (d < best) { best = d; type = s.type; sx = fx; sz = fz }
    }
    return { dist: best, type, x: sx, z: sz }
  }, [baseSegs])

  // Temel yol düğümleri (kavşak noktaları): uçları segment üstündeki rastgele
  // noktaya değil, gerçek bir düğüme yapıştırmak daha temiz hizalama verir.
  const baseNodes = useMemo(() => {
    const nodes: { x: number; z: number; type: string }[] = []
    if (!cityData) return nodes
    for (const r of cityData.roads)
      for (const [x, z] of r.points) nodes.push({ x, z, type: r.type })
    return nodes
  }, [cityData])

  const nearestNode = useCallback((px: number, pz: number) => {
    let best = Infinity, hit: { x: number; z: number; type: string } | null = null
    for (const n of baseNodes) {
      const d = Math.hypot(px - n.x, pz - n.z)
      if (d < best) { best = d; hit = n }
    }
    return { dist: best, node: hit }
  }, [baseNodes])

  // Düzenlemeleri uygulanmış şehir verisi: silinenler çıkar, eklenenler dahil.
  // Kullanıcı yollarının UÇLARI yakın yola SNAP'lenir → hizalama düzgün olur,
  // araç ağı bağlanır; tip (→ kalınlık) en yakın yoldan alınır.
  const SNAP = 9         // segment üstüne yapışma toleransı
  const NODE_SNAP = 7    // gerçek kavşak düğümüne yapışma (öncelikli)
  const MERGE_DIST = 2   // bundan yakın ardışık noktalar tek noktaya iner
  const MIN_LEN = 3.5    // toplam uzunluğu bundan kısa yollar = kazara tık → atılır

  // Bir ucu önce yakın bir düğüme, yoksa en yakın segment noktasına yapıştır.
  const snapEnd = useCallback((x: number, z: number) => {
    const n = nearestNode(x, z)
    if (n.node && n.dist <= NODE_SNAP)
      return { x: n.node.x, z: n.node.z, type: n.node.type, snapped: true }
    const s = nearestOnRoads(x, z)
    if (s.dist <= SNAP) return { x: s.x, z: s.z, type: s.type, snapped: true }
    return { x, z, type: null as string | null, snapped: false }
  }, [nearestNode, nearestOnRoads])

  const editedCity = useMemo<CityData | null>(() => {
    if (!cityData) return null
    const resolvedAdded = added.flatMap((a) => {
      // 1) ardışık çakışan/çok yakın noktaları birleştir
      const pts: [number, number][] = []
      for (const p of a.points) {
        const last = pts[pts.length - 1]
        if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > MERGE_DIST)
          pts.push([p[0], p[1]])
      }
      if (pts.length < 2) return []        // nokta kalmış → at

      // 2) uçları düğüm/segmente snap'le
      const sFirst = snapEnd(pts[0][0], pts[0][1])
      const sLast = snapEnd(pts[pts.length - 1][0], pts[pts.length - 1][1])
      pts[0] = [sFirst.x, sFirst.z]
      pts[pts.length - 1] = [sLast.x, sLast.z]

      // 3) toplam uzunluk çok kısaysa (kazara tık/stub) at
      let len = 0
      for (let i = 0; i < pts.length - 1; i++)
        len += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1])
      if (len < MIN_LEN) return []

      const type = sFirst.type ?? sLast.type ?? a.type
      return [{ ...a, points: pts, type }]
    })
    return {
      ...cityData,
      roads: cityData.roads.filter((r) => !removed.has(r.id)).concat(resolvedAdded),
    }
  }, [cityData, removed, added, snapEnd])

  // Yaya çarpışması için bina engelleri (merkez + ayak-izi yarıçapı)
  const obstacles = useMemo<Obstacle[]>(() => {
    if (!editedCity) return []
    return editedCity.buildings.map((b) => {
      const { kind, scale } = buildingScale(b.area, b.levels, b.id, b.tags.building ?? '')
      // Çarpışma = gerçek taban yarıçapına yakın (dar). Yola-itme için kullanılan
      // buildingFootprintRadius köşegen+pay ile geniştir; aralardan geçişi
      // engellememek için onun yerine sıkı bir değer kullan.
      // h = yaklaşık dünya yüksekliği (helikopterin üstünden uçabilmesi için).
      const hFactor = kind === 'sky' ? 2.4 : kind === 'commercial' ? 1.7 : 1.0
      return { x: b.center[0], z: b.center[1], r: scale * 0.5, h: scale * hFactor }
    })
  }, [editedCity])

  const handlePick = useCallback((x: number, z: number) => {
    if (tool === 'delete') {
      const id = nearestRoadId(x, z, editedCity?.roads ?? [], 10)
      if (id) removeRoad(id)
    } else {
      setDraft((prev) => [...prev, [x, z]])
    }
  }, [tool, editedCity, removeRoad])

  const finishRoad = useCallback(() => {
    addRoad(draft, 'primary')
    setDraft([])
  }, [draft, addRoad])

  return (
    <div className={styles.wrapper}>
      {status === 'loading' && <LoadingScreen />}
      {status === 'error'   && <LoadingScreen error={error} />}

      <Canvas
        shadows
        camera={{ position: [110, 90, 160], fov: 55, near: 2, far: 4000 }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={[night ? '#0a1228' : '#bcd9f0']} />
        {night
          ? <Sky sunPosition={[-80, -10, -60]} turbidity={10} rayleigh={0.2} mieCoefficient={0.005} />
          : <Sky sunPosition={[200, 120, 60]} turbidity={4} rayleigh={0.5} />}
        <Lighting night={night} />

        <Suspense fallback={<Fallback />}>
          <Ocean night={night} />
          <Ground />
          <Ships night={night} />
          <Harbor night={night} />
          <Helipad piloting={mode === 'heli'} night={night} />

          {editedCity && (
            <>
              <OsmCity cityData={editedCity} night={night} />
              <OsmVehicles cityData={editedCity} night={night} />
            </>
          )}

        </Suspense>

        {/* Oynanış kontrolcüleri AYRI Suspense'te → biri tek-kare yeniden
            yüklenince ana sahne donmaz (suspense thrash önlenir). */}
        <Suspense fallback={<Fallback />}>
          {mode === 'foot' && (
            <Player
              start={spawn}
              obstacles={obstacles}
              onBoardHeli={() => { setPrompt(null); setMode('heli') }}
              onBoardCar={(i, x, z, rot, url) => {
                setHijacked(i)
                setCar({ x, z, rot, url })
                setPrompt(null)
                setMode('car')
              }}
              onPromptChange={setPrompt}
            />
          )}
          {mode === 'heli' && (
            <HeliController
              start={[0, 0]}
              obstacles={obstacles}
              night={night}
              onExit={(x, z) => { setSpawn([x, z + 8]); setMode('foot') }}
            />
          )}
          {mode === 'car' && car.url && (
            <CarController
              start={[car.x, car.z]}
              startRot={car.rot}
              url={car.url}
              obstacles={obstacles}
              night={night}
              onExit={(x, z) => {
                setHijacked(-1)
                setSpawn([x + 4, z])
                setMode('foot')
              }}
            />
          )}
        </Suspense>

        <RoadEditor
          active={editOpen && mode === 'off'}
          tool={tool}
          roads={editedCity?.roads ?? []}
          draft={draft}
          onPick={handlePick}
        />

        {/* Oynanış modunda kamera karaktere/helikoptere kilitli → OrbitControls kapalı */}
        {mode === 'off' && (
          <>
            <OrbitControls
              makeDefault
              target={[0, 0, 0]}
              maxPolarAngle={Math.PI / 2.2}
              minDistance={40}
              maxDistance={750}
              enableDamping
              dampingFactor={0.05}
              mouseButtons={{
                LEFT: THREE.MOUSE.PAN,      // sol tık → gezme (pan)
                MIDDLE: THREE.MOUSE.DOLLY,
                RIGHT: THREE.MOUSE.ROTATE,  // sağ tık → döndürme (orbit)
              }}
            />
            <CameraRig />
          </>
        )}
      </Canvas>

      {status === 'ready' && <HUD />}

      {/* GTA tarzı binme balonu (yaya modunda, yakındayken) */}
      {mode === 'foot' && prompt && (
        <div className={styles.prompt} key={prompt}>
          <span className={styles.promptKey}>{prompt === 'heli' ? 'E' : 'F'}</span>
          <span className={styles.promptText}>
            {prompt === 'heli' ? 'Helikoptere bin' : 'Arabaya bin'}
          </span>
        </div>
      )}

      {status === 'ready' && (
        <div className={styles.topRight}>
          <div className={styles.iconRow}>
            <button
              className={styles.iconBtn}
              onClick={() => setNight((v) => !v)}
              title={night ? 'Gündüz' : 'Gece'}
              aria-label={night ? 'Gündüz' : 'Gece'}
            >
              {night ? <SunIcon /> : <MoonIcon />}
            </button>
            <button
              className={`${styles.iconBtn} ${editOpen ? styles.iconActive : ''}`}
              onClick={() => setEditOpen((v) => !v)}
              title="Yol Düzenle"
              aria-label="Yol Düzenle"
            >
              <PencilIcon />
            </button>
            <button
              className={`${styles.iconBtn} ${mode !== 'off' ? styles.iconActive : ''}`}
              onClick={() => setMode((m) => (m === 'off' ? 'foot' : 'off'))}
              title="Karakter modu (WASD + Space, helikopter için E)"
              aria-label="Karakter modu"
            >
              <PersonIcon />
            </button>
          </div>

          {editOpen && (
            <EditorPanel
              tool={tool}
              setTool={setTool}
              draftLen={draft.length}
              removedCount={removed.size}
              addedCount={added.length}
              onFinishRoad={finishRoad}
              onCancelDraft={() => setDraft([])}
              onUndoAdd={undoAdd}
              onRestoreRemoved={restoreRemoved}
              onResetAll={() => { resetAll(); setDraft([]) }}
            />
          )}
        </div>
      )}
    </div>
  )
}
