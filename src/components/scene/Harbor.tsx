import { useMemo } from 'react'
import * as THREE from 'three'
import Model from '../shared/Model'
import {
  shipCargoA, shipLiner, boatTugA, boatHouseA, boatRowLarge,
  cargoContA, cargoContB, cargoContC, cargoPileA, cargoPileB,
  buoy, buoyFlag,
  trainContBlue, trainContGreen, trainContRed,
} from '../../assets/models'
import { SHIP_SCALE, BOAT_SCALE, islandRadius, ISLAND_MAX_R } from '../../constants/cityLayout'

const DECK_COLOR   = '#b8bcc2'   // beton güverte
const EDGE_COLOR   = '#e8eaed'   // beyaz kenar şeridi
const RAIL_COLOR   = '#cfd4d8'   // çelik korkuluk
const BOLLARD_COL  = '#2b2d31'
const STEEL_COLOR  = '#5b6168'   // gantry vinç çeliği
const ACCENT_COLOR = '#f5a623'   // turuncu modern aksan

// ─── Modern beton iskele güvertesi + çelik korkuluk ──────────────────────────
function Deck({ w, d }: { w: number; d: number }) {
  // korkuluk dikme konumları (iki uzun kenar boyunca)
  const posts = Math.max(3, Math.round(d / 4))
  return (
    <group>
      {/* beton taban */}
      <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, 0.8, d]} />
        <meshLambertMaterial color={DECK_COLOR} />
      </mesh>
      {/* beyaz kenar şeritleri (modern dış hat) */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (w / 2 - 0.4), 0.82, 0]} receiveShadow>
          <boxGeometry args={[0.6, 0.06, d - 0.4]} />
          <meshLambertMaterial color={EDGE_COLOR} />
        </mesh>
      ))}
      {/* turuncu orta yürüme bandı */}
      <mesh position={[0, 0.82, 0]} receiveShadow>
        <boxGeometry args={[1.0, 0.05, d - 1]} />
        <meshLambertMaterial color={ACCENT_COLOR} />
      </mesh>
      {/* çelik korkuluk: iki kenarda dikmeler + üst ray */}
      {[-1, 1].map((s) => {
        const x = s * (w / 2 - 0.25)
        return (
          <group key={s}>
            <mesh position={[x, 1.5, 0]}>
              <boxGeometry args={[0.08, 0.08, d - 0.6]} />
              <meshLambertMaterial color={RAIL_COLOR} />
            </mesh>
            {Array.from({ length: posts }, (_, i) => {
              const z = -d / 2 + (i + 0.5) * (d / posts)
              return (
                <mesh key={i} position={[x, 1.1, z]}>
                  <cylinderGeometry args={[0.05, 0.05, 1.2, 6]} />
                  <meshLambertMaterial color={RAIL_COLOR} />
                </mesh>
              )
            })}
          </group>
        )
      })}
    </group>
  )
}

// Modern bağlama babası (çelik silindir + turuncu kep)
function Bollard({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 1.15, 0]} castShadow>
        <cylinderGeometry args={[0.4, 0.5, 1.5, 12]} />
        <meshLambertMaterial color={BOLLARD_COL} />
      </mesh>
      <mesh position={[0, 1.95, 0]} castShadow>
        <cylinderGeometry args={[0.5, 0.4, 0.25, 12]} />
        <meshLambertMaterial color={ACCENT_COLOR} />
      </mesh>
    </group>
  )
}

// Modern gantry (portal) konteyner vinci — kargo limanı için
function GantryCrane({ span, z }: { span: number; z: number }) {
  const legH = 9
  const beamY = legH
  return (
    <group position={[0, 0, z]}>
      {/* iki bacak */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * span / 2, legH / 2 + 0.8, 0]} castShadow>
          <boxGeometry args={[0.7, legH, 0.7]} />
          <meshLambertMaterial color={STEEL_COLOR} />
        </mesh>
      ))}
      {/* üst kiriş */}
      <mesh position={[0, beamY + 1.1, 0]} castShadow>
        <boxGeometry args={[span + 2, 0.8, 1.0]} />
        <meshLambertMaterial color={ACCENT_COLOR} />
      </mesh>
      {/* taşıyıcı (trolley) */}
      <mesh position={[span * 0.15, beamY + 0.4, 0]} castShadow>
        <boxGeometry args={[1.4, 1.0, 1.2]} />
        <meshLambertMaterial color={STEEL_COLOR} />
      </mesh>
    </group>
  )
}

// Cam yolcu terminali
function Terminal({ w, d }: { w: number; d: number }) {
  return (
    <group>
      <mesh position={[0, 2.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, 4, d]} />
        <meshLambertMaterial color="#7fb3d5" transparent opacity={0.65} />
      </mesh>
      {/* düz çatı saçağı */}
      <mesh position={[0, 4.3, 0]} castShadow>
        <boxGeometry args={[w + 1.5, 0.4, d + 1.5]} />
        <meshLambertMaterial color="#e8eaed" />
      </mesh>
    </group>
  )
}

// Liman projektörü (gece): direk + parlak lamba başı
function FloodLight({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 3.5, 0]}><cylinderGeometry args={[0.15, 0.2, 7, 8]} /><meshLambertMaterial color="#444" /></mesh>
      <mesh position={[0, 7.1, 0]}>
        <sphereGeometry args={[0.5, 10, 10]} />
        <meshStandardMaterial color="#fff" emissive="#ffe9b0" emissiveIntensity={2.5} />
      </mesh>
    </group>
  )
}

// Kıyıdan dışa uzanan, açıya göre konumlanmış bir liman bölgesi
function HarborZone({
  angle, deckW, deckD, night, children,
}: {
  angle: number; deckW: number; deckD: number; night: boolean; children?: React.ReactNode
}) {
  // kıyı noktası ve dışa doğru normal — organik kıyıdan örnekle
  const nx = Math.cos(angle)
  const nz = Math.sin(angle)
  const shoreR = islandRadius(angle) - 4
  const shoreX = nx * shoreR
  const shoreZ = nz * shoreR
  // güverte merkezi kıyıdan deckD/2 kadar dışarıda
  const cx = shoreX + nx * (deckD / 2)
  const cz = shoreZ + nz * (deckD / 2)
  const rotY = -Math.atan2(nz, nx)   // güverte uzunluğu radyal yönde

  return (
    <group position={[cx, 0, cz]} rotation={[0, rotY, 0]}>
      <Deck w={deckW} d={deckD} />
      <Bollard x={0} z={-deckD / 2 + 1.5} />
      <Bollard x={0} z={ deckD / 2 - 1.5} />
      {night && (
        <>
          <FloodLight x={-deckW / 2 + 1.5} z={-deckD / 2 + 2} />
          <FloodLight x={ deckW / 2 - 1.5} z={-deckD / 2 + 2} />
          <FloodLight x={-deckW / 2 + 1.5} z={ deckD / 2 - 2} />
          <FloodLight x={ deckW / 2 - 1.5} z={ deckD / 2 - 2} />
          <pointLight position={[0, 10, 0]} intensity={120} distance={70} decay={2} color="#ffe9b0" />
        </>
      )}
      {children}
    </group>
  )
}

export default function Harbor({ night = false }: { night?: boolean }) {
  // Liman açıları (yuvarlak kıyı çevresinde dağıtılmış)
  const ANG = useMemo(() => ({
    cargo: 0,                 // +X yönü
    passenger: Math.PI / 2,   // +Z yönü
    marina: Math.PI,          // -X yönü
  }), [])

  return (
    <>
      {/* ════════ KARGO LİMANI (modern gantry vinçli) ════════ */}
      <HarborZone angle={ANG.cargo} deckW={34} deckD={46} night={night}>
        {/* istiflenmiş konteynerler */}
        <Model url={cargoContA} position={[-9, 1.0, -12]} scale={4.5} />
        <Model url={cargoContB} position={[-9, 1.0,  -1]} scale={4.5} />
        <Model url={cargoContC} position={[-9, 1.0,  10]} scale={4.5} />
        <Model url={cargoContA} position={[-9, 5.0, -12]} scale={4.5} />
        <Model url={cargoContC} position={[-9, 5.0,  -1]} scale={4.5} />
        <Model url={cargoPileA} position={[ 9, 1.0,  -8]} rotation={[0, Math.PI / 2, 0]} scale={4.5} />
        <Model url={cargoPileB} position={[ 9, 1.0,   8]} rotation={[0, Math.PI / 2, 0]} scale={4.5} />
        {/* modern portal vinçler */}
        <GantryCrane span={30} z={-6} />
        <GantryCrane span={30} z={14} />
        {/* tren konteyner vagonları (kara-deniz lojistik) */}
        <Model url={trainContBlue}  position={[14, 0.2, -16]} rotation={[0, 0, 0]} scale={4.2} />
        <Model url={trainContGreen} position={[14, 0.2,  -4]} rotation={[0, 0, 0]} scale={4.2} />
        <Model url={trainContRed}   position={[14, 0.2,   8]} rotation={[0, 0, 0]} scale={4.2} />
        {/* yanaşmış kargo gemisi + römorkör — rıhtımın YANINDA (deniz tarafı) */}
        <Model url={shipCargoA} position={[30, -0.5,  2]} rotation={[0, 0, 0]} scale={SHIP_SCALE} />
        <Model url={boatTugA}   position={[28, -0.4, -16]} rotation={[0, 0, 0]} scale={BOAT_SCALE} />
      </HarborZone>

      {/* ════════ YOLCU LİMANI (cam terminal) ════════ */}
      <HarborZone angle={ANG.passenger} deckW={30} deckD={40} night={night}>
        <Terminal w={20} d={12} />
        <Model url={shipLiner} position={[28, -0.5, 0]} rotation={[0, 0, 0]} scale={SHIP_SCALE} />
        <Bollard x={-10} z={-14} />
        <Bollard x={ 10} z={-14} />
      </HarborZone>

      {/* ════════ MARİNA (küçük tekneler — güvertenin YANINDA, suda) ════════ */}
      {/* deck: w=22 (x ±11), d=30 (z ±15). Tekneler x>11 veya z>15 → su. */}
      <HarborZone angle={ANG.marina} deckW={22} deckD={30} night={night}>
        <Model url={boatHouseA}   position={[ 16, -0.4, -6]} rotation={[0, 0, 0]} scale={BOAT_SCALE * 1.2} />
        <Model url={boatRowLarge} position={[ 16, -0.4,  6]} rotation={[0, 0, 0]} scale={BOAT_SCALE} />
        <Model url={boatTugA}     position={[-16, -0.4,  0]} rotation={[0, 0, 0]} scale={BOAT_SCALE} />
      </HarborZone>

      {/* ════════ Şamandıralar (liman girişi işaretleri) ════════ */}
      <Model url={buoyFlag} position={[ISLAND_MAX_R + 18, -0.5, -30]} scale={BOAT_SCALE} />
      <Model url={buoy}     position={[ISLAND_MAX_R + 10, -0.5,  35]} scale={BOAT_SCALE} />
      <Model url={buoyFlag} position={[30,  -0.5, ISLAND_MAX_R + 18]} scale={BOAT_SCALE} />
      <Model url={buoy}     position={[-35, -0.5, ISLAND_MAX_R + 10]} scale={BOAT_SCALE} />
    </>
  )
}
