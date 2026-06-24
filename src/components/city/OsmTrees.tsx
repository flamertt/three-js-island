import { useMemo } from 'react'
import Model from '../shared/Model'
import { TREE_MODELS } from '../../constants/cityLayout'
import { seededRng, pickRandom } from '../../utils/seededRng'
import type { RoadSegment } from '../../types/osm'

interface Props { roads: RoadSegment[] }

const TREE_TYPES  = ['primary', 'secondary', 'tertiary', 'residential', 'unclassified']
const TREE_SPACING  = 5       // closer spacing → more trees
const SIDEWALK_GAP  = 3.2

interface TreeSpec {
  key: string; url: string
  x: number; z: number; scale: number
}

export default function OsmTrees({ roads }: Props) {
  const trees = useMemo<TreeSpec[]>(() => {
    const rng     = seededRng(7331)
    const result: TreeSpec[] = []
    const eligible = roads.filter((r) => TREE_TYPES.includes(r.type))

    for (const road of eligible) {
      for (let i = 0; i < road.points.length - 1; i++) {
        const [x1, z1] = road.points[i]
        const [x2, z2] = road.points[i + 1]
        const dx = x2 - x1, dz = z2 - z1
        const len = Math.sqrt(dx * dx + dz * dz)
        if (len < TREE_SPACING) continue

        const px = -dz / len
        const pz =  dx / len
        const steps = Math.floor(len / TREE_SPACING)

        for (let s = 0; s < steps; s++) {
          const t  = (s + 0.5) / steps
          const cx = x1 + dx * t
          const cz = z1 + dz * t

          for (const side of [1, -1]) {
            result.push({
              key: `${road.id}_${i}_${s}_${side}`,
              url: pickRandom(TREE_MODELS, rng),
              x: cx + px * SIDEWALK_GAP * side,
              z: cz + pz * SIDEWALK_GAP * side,
              scale: 1.0 + rng() * 0.9,
            })
          }
        }
      }
    }
    return result
  }, [roads])

  return (
    <>
      {trees.map((t) => (
        <Model key={t.key} url={t.url} position={[t.x, 0, t.z]} scale={t.scale} />
      ))}
    </>
  )
}
