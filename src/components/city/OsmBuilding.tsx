import Model from '../shared/Model'
import {
  SKYSCRAPER_MODELS, COMMERCIAL_MODELS, SUBURBAN_MODELS,
  buildingScale,
} from '../../constants/cityLayout'
import { seededRng, pickRandom } from '../../utils/seededRng'
import type { BuildingEntity } from '../../types/osm'

interface Props { building: BuildingEntity; night?: boolean }

// Ölçek + kategori paylaşılan deterministik fonksiyondan; model seçimi rng ile.
function resolveModel(b: BuildingEntity, rng: () => number) {
  const { kind, scale } = buildingScale(b.area, b.levels, b.id, b.tags.building ?? '')
  const models = kind === 'sky' ? SKYSCRAPER_MODELS
    : kind === 'commercial' ? COMMERCIAL_MODELS : SUBURBAN_MODELS
  return { url: pickRandom(models, rng), scale }
}

export default function OsmBuilding({ building, night = false }: Props) {
  const rng = seededRng(Math.abs(building.id))
  const { url, scale } = resolveModel(building, rng)
  // En yakın yola hizala (yoksa rastgele 90° kademe). Cephe yola paralel olur,
  // 0/π belirsizliği için iki yönden birini deterministik seç.
  const base = building.rot ?? Math.floor(rng() * 4) * (Math.PI / 2)
  const rotY = base + (rng() > 0.5 ? Math.PI : 0)

  return (
    <Model
      url={url}
      position={[building.center[0], 0, building.center[1]]}
      rotation={[0, rotY, 0]}
      scale={scale}
      glow={night}
    />
  )
}
