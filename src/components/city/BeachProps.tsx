import { useMemo } from 'react'
import { islandRadius, BEACH_WIDTH } from '../../constants/cityLayout'
import { seededRng } from '../../utils/seededRng'

const PARASOL_COLORS = ['#e8503a', '#3a7be8', '#f0b429', '#2ecc71', '#e84393']
const TOWEL_COLORS   = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#a78bfa', '#ffffff']
const CLUSTERS = 26

// Liman bölgeleri kıyıyı işgal eder (iskele + yanaşmış gemiler/tekneler suya
// uzanır). Bu açılara denk gelen sahil kümeleri iskele/gemi yanında "denizde"
// görünür → bu açıların çevresini boş bırak.
const HARBOR_ANGLES = [0, Math.PI / 2, Math.PI]
const HARBOR_CLEAR = 0.32   // rad — liman açısı çevresinde sahil eşyası yok
function nearHarbor(theta: number): boolean {
  return HARBOR_ANGLES.some((h) => {
    const d = Math.abs(((theta - h + Math.PI) % (2 * Math.PI)) - Math.PI)
    return d < HARBOR_CLEAR
  })
}

// Bir parçayı, KENDİ açısının kum bandına kutupsal olarak yerleştir.
// frac ∈ [0,1] → kum bandı içindeki radyal konum (0=çim kenarı, 1=su kenarı).
// Böylece organik/yamuk kıyıda her parça daima kumda kalır.
function place(theta: number, frac: number) {
  const inner = islandRadius(theta) + 2.5            // çim kenarından pay
  const outer = islandRadius(theta) + BEACH_WIDTH - 3 // su kenarından pay
  const r = inner + frac * (outer - inner)
  return {
    x: Math.cos(theta) * r,
    z: Math.sin(theta) * r,
    faceSea: Math.atan2(Math.cos(theta), Math.sin(theta)), // +z dışa (denize)
  }
}

function Lounger({ x, z, rot, color }: { x: number; z: number; rot: number; color: string }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <mesh position={[0, 0.25, 0]} castShadow>
        <boxGeometry args={[1.1, 0.12, 2.4]} />
        <meshLambertMaterial color="#d8d8d8" />
      </mesh>
      <mesh position={[0, 0.34, 0.2]} castShadow>
        <boxGeometry args={[1.0, 0.1, 1.7]} />
        <meshLambertMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.62, 1.0]} rotation={[Math.PI / 4, 0, 0]} castShadow>
        <boxGeometry args={[1.0, 0.1, 1.0]} />
        <meshLambertMaterial color={color} />
      </mesh>
    </group>
  )
}

function Parasol({ x, z, color }: { x: number; z: number; color: string }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 1.4, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.06, 2.8, 6]} />
        <meshLambertMaterial color="#8a6b47" />
      </mesh>
      <mesh position={[0, 2.7, 0]} castShadow>
        <coneGeometry args={[1.8, 0.9, 12]} />
        <meshLambertMaterial color={color} />
      </mesh>
    </group>
  )
}

export default function BeachProps() {
  const clusters = useMemo(() => {
    const rng = seededRng(2024)
    const out: { a: number; pc: string; tc: string; ball: boolean }[] = []
    for (let i = 0; i < CLUSTERS; i++) {
      const a = (i / CLUSTERS) * Math.PI * 2 + (rng() - 0.5) * 0.1
      const ball = rng() < 0.4   // rng sırasını koru
      if (nearHarbor(a)) continue // liman bölgesi → atla
      out.push({
        a,
        pc: PARASOL_COLORS[i % PARASOL_COLORS.length],
        tc: TOWEL_COLORS[(i * 3) % TOWEL_COLORS.length],
        ball,
      })
    }
    return out
  }, [])

  return (
    <>
      {clusters.map((c, i) => {
        const dA = 0.022   // yanlara küçük açısal ayrım
        const parasol = place(c.a, 0.5)
        const lo1 = place(c.a + dA, 0.42)
        const lo2 = place(c.a - dA, 0.42)
        const towel = place(c.a, 0.75)
        const ball = place(c.a + dA * 1.6, 0.3)
        return (
          <group key={i}>
            <Parasol x={parasol.x} z={parasol.z} color={c.pc} />
            <Lounger x={lo1.x} z={lo1.z} rot={lo1.faceSea} color={c.tc} />
            <Lounger x={lo2.x} z={lo2.z} rot={lo2.faceSea} color={c.pc} />
            <mesh position={[towel.x, 0.06, towel.z]} rotation={[-Math.PI / 2, 0, towel.faceSea]}>
              <planeGeometry args={[1.1, 1.8]} />
              <meshLambertMaterial color={c.tc} />
            </mesh>
            {c.ball && (
              <mesh position={[ball.x, 0.4, ball.z]} castShadow>
                <sphereGeometry args={[0.4, 12, 12]} />
                <meshLambertMaterial color="#ff5252" />
              </mesh>
            )}
          </group>
        )
      })}
    </>
  )
}
