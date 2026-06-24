import { useMemo } from 'react'
import Model from '../shared/Model'
import { cornCrop, wheatCrop, bambooCrop, dirtRow, fenceSimple, fenceGate } from '../../assets/models'
import { seededRng, pickRandom } from '../../utils/seededRng'
import { FARM_CENTER, FARM_RADIUS } from '../../constants/cityLayout'

const CROPS = [cornCrop, wheatCrop, bambooCrop]
const ROW = 4          // satır aralığı (birim)
const PLOT = FARM_RADIUS - 6
const CROP_SCALE = 3.5
const DIRT_SCALE = 4.0
const FENCE_SCALE = 3.0
const FENCE_LEN = 3.0  // fence_simple ~1 birim × FENCE_SCALE

export default function Farm() {
  const { crops, dirt, fence } = useMemo(() => {
    const rng = seededRng(7788)
    const crops: { url: string; x: number; z: number; s: number }[] = []
    const dirt: { x: number; z: number; rot: number }[] = []
    const [cx, cz] = FARM_CENTER

    // ızgara: dairesel parselde sıralar
    for (let gx = -PLOT; gx <= PLOT; gx += ROW) {
      for (let gz = -PLOT; gz <= PLOT; gz += ROW) {
        if (Math.hypot(gx, gz) > PLOT) continue
        // toprak sırası
        dirt.push({ x: cx + gx, z: cz + gz, rot: 0 })
        // ekin (her hücreye 2-3 bitki)
        const n = 1 + Math.floor(rng() * 2)
        for (let k = 0; k < n; k++) {
          crops.push({
            url: pickRandom(CROPS, rng),
            x: cx + gx + (rng() - 0.5) * 2.4,
            z: cz + gz + (rng() - 0.5) * 2.4,
            s: CROP_SCALE * (0.85 + rng() * 0.3),
          })
        }
      }
    }

    // çit çevresi (dairesel)
    const fence: { x: number; z: number; rot: number; gate: boolean }[] = []
    const fr = PLOT + 2.5
    const circ = 2 * Math.PI * fr
    const segs = Math.max(8, Math.round(circ / FENCE_LEN))
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2
      fence.push({
        x: cx + Math.cos(a) * fr,
        z: cz + Math.sin(a) * fr,
        rot: a + Math.PI / 2,         // çit teğet yönde
        gate: i === 0,                // bir kapı
      })
    }

    return { crops, dirt, fence }
  }, [])

  return (
    <>
      {dirt.map((d, i) => (
        <Model key={`d${i}`} url={dirtRow} position={[d.x, 0.06, d.z]} rotation={[0, d.rot, 0]} scale={DIRT_SCALE} />
      ))}
      {crops.map((c, i) => (
        <Model key={`c${i}`} url={c.url} position={[c.x, 0.05, c.z]} scale={c.s} />
      ))}
      {fence.map((f, i) => (
        <Model key={`f${i}`} url={f.gate ? fenceGate : fenceSimple} position={[f.x, 0, f.z]} rotation={[0, f.rot, 0]} scale={FENCE_SCALE} />
      ))}
    </>
  )
}
