import { useMemo } from 'react'
import * as THREE from 'three'
import Model from '../shared/Model'
import { SUBURBAN_MODELS } from '../../constants/cityLayout'
import { seededRng, pickRandom } from '../../utils/seededRng'

// ─── Geometry ─────────────────────────────────────────────────────────────────
// Outer ring of land that shows beyond the ocean channel.
// Shape: large rectangle with a rectangular hole cut out for the ocean channel.
//
// City island:          ±200 X,  ±165 Z  (ground plane)
// Ocean channel inner:  ±230 X,  ±195 Z  (no ground here → ocean shows)
// Ocean channel outer:  ±370 X,  ±305 Z  (suburban starts here)
// Suburban outer:       ±760 X,  ±630 Z

const INNER_X = 370, INNER_Z = 305   // hole inner edge (ocean channel outer)
const OUTER_X = 760, OUTER_Z = 630   // suburban outer edge

function makeSuburbanGround(): THREE.BufferGeometry {
  const shape = new THREE.Shape()
  shape.moveTo(-OUTER_X, -OUTER_Z)
  shape.lineTo( OUTER_X, -OUTER_Z)
  shape.lineTo( OUTER_X,  OUTER_Z)
  shape.lineTo(-OUTER_X,  OUTER_Z)

  // Rectangular hole → ocean channel shows through
  const hole = new THREE.Path()
  hole.moveTo(-INNER_X, -INNER_Z)
  hole.lineTo( INNER_X, -INNER_Z)
  hole.lineTo( INNER_X,  INNER_Z)
  hole.lineTo(-INNER_X,  INNER_Z)
  shape.holes.push(hole)

  const geo = new THREE.ShapeGeometry(shape, 1)
  // ShapeGeometry lies in XY plane — rotate to XZ
  geo.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2))
  return geo
}

// ─── Suburban buildings ───────────────────────────────────────────────────────
const HOUSE_SCALE = 2.2
const HOUSE_COUNT = 220

function generateHousePositions(rng: () => number): { x: number; z: number; rotY: number; url: string }[] {
  const houses: { x: number; z: number; rotY: number; url: string }[] = []
  const placed: [number, number][] = []
  const MIN_DIST = 18
  let attempts = 0

  while (houses.length < HOUSE_COUNT && attempts < 4000) {
    attempts++
    // Random position in the suburban ring (beyond INNER_X/Z)
    const side = Math.floor(rng() * 4)  // which side of the ring
    let x: number, z: number

    if (side === 0) {
      // left strip
      x = -(INNER_X + rng() * (OUTER_X - INNER_X - 20))
      z = (rng() * 2 - 1) * (OUTER_Z - 20)
    } else if (side === 1) {
      // right strip
      x = INNER_X + rng() * (OUTER_X - INNER_X - 20)
      z = (rng() * 2 - 1) * (OUTER_Z - 20)
    } else if (side === 2) {
      // top strip
      x = (rng() * 2 - 1) * (OUTER_X - 20)
      z = -(INNER_Z + rng() * (OUTER_Z - INNER_Z - 20))
    } else {
      // bottom strip
      x = (rng() * 2 - 1) * (OUTER_X - 20)
      z = INNER_Z + rng() * (OUTER_Z - INNER_Z - 20)
    }

    // spacing check
    let ok = true
    for (const [px, pz] of placed) {
      const dx = x - px, dz = z - pz
      if (dx * dx + dz * dz < MIN_DIST * MIN_DIST) { ok = false; break }
    }
    if (!ok) continue

    placed.push([x, z])
    houses.push({
      x, z,
      rotY: Math.floor(rng() * 4) * (Math.PI / 2),
      url: pickRandom(SUBURBAN_MODELS, rng),
    })
  }

  return houses
}

export default function SuburbanRing() {
  const geo = useMemo(() => makeSuburbanGround(), [])

  const mat = useMemo(
    () => new THREE.MeshLambertMaterial({ color: '#8fa870' }),  // muted grass-green
    [],
  )

  const houses = useMemo(() => {
    const rng = seededRng(9999)
    return generateHousePositions(rng)
  }, [])

  return (
    <>
      {/* Suburban land ring */}
      <mesh geometry={geo} material={mat} position={[0, -0.2, 0]} receiveShadow />

      {/* Suburban houses */}
      {houses.map((h, i) => (
        <Model
          key={i}
          url={h.url}
          position={[h.x, -0.2, h.z]}
          rotation={[0, h.rotY, 0]}
          scale={HOUSE_SCALE}
        />
      ))}
    </>
  )
}
