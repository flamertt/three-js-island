import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import type { RoadSegment } from '../../types/osm'

export type EditTool = 'delete' | 'add'

interface Props {
  active: boolean
  tool: EditTool
  roads: RoadSegment[]
  draft: [number, number][]
  onPick: (x: number, z: number) => void
}

// Noktanın bir polyline'a en yakın uzaklığı
function distToRoad(px: number, pz: number, r: RoadSegment): number {
  let best = Infinity
  for (let i = 0; i < r.points.length - 1; i++) {
    const [x1, z1] = r.points[i]
    const [x2, z2] = r.points[i + 1]
    const dx = x2 - x1, dz = z2 - z1
    const len2 = dx * dx + dz * dz || 1e-6
    let t = ((px - x1) * dx + (pz - z1) * dz) / len2
    t = Math.max(0, Math.min(1, t))
    const fx = x1 + dx * t, fz = z1 + dz * t
    const d = Math.hypot(px - fx, pz - fz)
    if (d < best) best = d
  }
  return best
}

export function nearestRoadId(px: number, pz: number, roads: RoadSegment[], maxDist = 5): string | null {
  let best: string | null = null
  let bestD = maxDist
  for (const r of roads) {
    const d = distToRoad(px, pz, r)
    if (d < bestD) { bestD = d; best = r.id }
  }
  return best
}

export default function RoadEditor({ active, tool, draft, onPick }: Props) {
  // taslak çizgi geometrisi
  const draftGeo = useMemo(() => {
    if (draft.length < 1) return null
    const g = new THREE.BufferGeometry()
    const pos: number[] = []
    for (const [x, z] of draft) pos.push(x, 0.35, z)
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    return g
  }, [draft])

  const down = useRef<{ sx: number; sy: number; x: number; z: number } | null>(null)

  if (!active) return null

  // pointerdown'da konumu kaydet; pointerup'ta az hareket varsa = tıklama
  const onDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    down.current = { sx: e.nativeEvent.clientX, sy: e.nativeEvent.clientY, x: e.point.x, z: e.point.z }
  }
  const onUp = (e: ThreeEvent<PointerEvent>) => {
    const d = down.current
    down.current = null
    if (!d) return
    const moved = Math.hypot(e.nativeEvent.clientX - d.sx, e.nativeEvent.clientY - d.sy)
    if (moved > 6) return                 // sürükleme → kamera, tıklama değil
    onPick(e.point.x, e.point.z)
  }

  return (
    <>
      {/* tıklama düzlemi (görünmez, tüm adayı kaplar) */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.2, 0]}
        onPointerDown={onDown}
        onPointerUp={onUp}
      >
        <planeGeometry args={[900, 900]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* ekleme modunda taslak nokta/çizgi */}
      {tool === 'add' && draftGeo && (
        <>
          <line>
            <primitive object={draftGeo} attach="geometry" />
            <lineBasicMaterial color="#ffcc00" linewidth={3} />
          </line>
          {draft.map(([x, z], i) => (
            <mesh key={i} position={[x, 0.4, z]}>
              <sphereGeometry args={[0.9, 10, 10]} />
              <meshBasicMaterial color={i === 0 ? '#00e676' : '#ffcc00'} />
            </mesh>
          ))}
        </>
      )}
    </>
  )
}
