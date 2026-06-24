import * as THREE from 'three'
import HelicopterModel from './HelicopterModel'

interface Props {
  position?: [number, number, number]
  deckR?: number
  piloting?: boolean   // pilotlu uçuştayken pisteki statik helikopteri gizle
}

function HMark({ y, s }: { y: number; s: number }) {
  const white = '#f2f2f2'
  return (
    <group position={[0, y, 0]} scale={s}>
      <mesh position={[-1.2, 0, 0]}><boxGeometry args={[0.5, 0.05, 3]} /><meshLambertMaterial color={white} /></mesh>
      <mesh position={[1.2, 0, 0]}><boxGeometry args={[0.5, 0.05, 3]} /><meshLambertMaterial color={white} /></mesh>
      <mesh position={[0, 0, 0]}><boxGeometry args={[2.4, 0.05, 0.5]} /><meshLambertMaterial color={white} /></mesh>
    </group>
  )
}

export default function Helipad({ position = [0, 0, 0], deckR = 26, piloting = false }: Props) {
  const [x, , z] = position
  const lights = 14
  const padY = 0.3   // yere yakın, ince saha
  return (
    <group position={[x, 0, z]}>
      {/* yer seviyesinde ince saha (platform yok) */}
      <mesh position={[0, padY / 2, 0]} receiveShadow>
        <cylinderGeometry args={[deckR, deckR, padY, 40]} />
        <meshLambertMaterial color="#3a3d42" />
      </mesh>
      {/* beyaz çember */}
      <mesh position={[0, padY + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[deckR * 0.6, deckR * 0.68, 48]} />
        <meshLambertMaterial color="#f2f2f2" side={THREE.DoubleSide} />
      </mesh>
      <HMark y={padY + 0.02} s={deckR / 6} />
      {/* kenar ışıkları */}
      {Array.from({ length: lights }, (_, i) => {
        const a = (i / lights) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(a) * (deckR - 0.6), padY + 0.2, Math.sin(a) * (deckR - 0.6)]}>
            <sphereGeometry args={[0.3, 8, 8]} />
            <meshStandardMaterial color="#ffe066" emissive="#ffcc00" emissiveIntensity={0.9} />
          </mesh>
        )
      })}
      {/* helikopter (büyük) — pilotlu uçuşta gizli */}
      {!piloting && (
        <group position={[0, padY, 0]} scale={1.8}>
          <HelicopterModel />
        </group>
      )}
    </group>
  )
}

// Pist merkezi ve helikopter ölçeği — diğer modüller (pilot kontrolcüsü,
// binme mesafesi) ile paylaşılır.
export const HELIPAD_CENTER: [number, number] = [0, 0]
export const HELI_SCALE = 1.8
export const HELI_PAD_Y = 0.3
