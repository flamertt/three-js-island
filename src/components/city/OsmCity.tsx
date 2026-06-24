import { useMemo } from 'react'
import type { CityData } from '../../types/osm'
import OsmRoadNetwork from './OsmRoad'
import OsmBuilding from './OsmBuilding'
import CityProps from './CityProps'
import People from './People'
import StreetLamps from './StreetLamps'
import BeachProps from './BeachProps'
import Farm from './Farm'

interface Props { cityData: CityData; night?: boolean }

export default function OsmCity({ cityData, night = false }: Props) {
  const { roads, buildings, water } = cityData

  const waterMeshes = useMemo(() =>
    water.map((w) => {
      const xs = w.points.map((p) => p[0])
      const zs = w.points.map((p) => p[1])
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2
      const cz = (Math.min(...zs) + Math.max(...zs)) / 2
      const wx = Math.max(Math.max(...xs) - Math.min(...xs), 1)
      const wz = Math.max(Math.max(...zs) - Math.min(...zs), 1)
      return { id: w.id, cx, cz, wx, wz }
    }),
  [water])

  return (
    <>
      {/* Tüm yollar tek mesh → tek draw call */}
      <OsmRoadNetwork roads={roads} />

      {/* Su */}
      {waterMeshes.map((w) => (
        <mesh key={w.id} position={[w.cx, 0.05, w.cz]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[w.wx, w.wz]} />
          <meshLambertMaterial color="#3a7bbf" transparent opacity={0.85} />
        </mesh>
      ))}

      {/* Binalar */}
      {buildings.map((b) => (
        <OsmBuilding key={b.id} building={b} night={night} />
      ))}

      {/* Yeşillendirme (sadece boş yeşil alanlar) */}
      <CityProps cityData={cityData} />

      {/* Yol kenarı sokak lambaları */}
      <StreetLamps roads={roads} />

      {/* Tarım/park alanı */}
      <Farm />

      {/* Sahil eşyaları (şezlong, şemsiye, havlu, top) */}
      <BeachProps />

      {/* İnsanlar (çim + sahil, yürüyen/duran) */}
      <People cityData={cityData} />
    </>
  )
}
