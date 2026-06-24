import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface Props {
  position?: [number, number, number]
  deckR?: number
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

function Helicopter() {
  const mainRotor = useRef<THREE.Group>(null!)
  const tailRotor = useRef<THREE.Group>(null!)
  useFrame((_, dt) => {
    if (mainRotor.current) mainRotor.current.rotation.y += dt * 9
    if (tailRotor.current) tailRotor.current.rotation.x += dt * 14
  })
  const body = '#c0392b'
  const dark = '#2c2c30'
  return (
    <group>
      <mesh position={[-0.9, 0.15, 0]}><boxGeometry args={[0.12, 0.12, 3]} /><meshLambertMaterial color={dark} /></mesh>
      <mesh position={[0.9, 0.15, 0]}><boxGeometry args={[0.12, 0.12, 3]} /><meshLambertMaterial color={dark} /></mesh>
      <mesh position={[-0.9, 0.5, 0.8]}><boxGeometry args={[0.1, 0.7, 0.1]} /><meshLambertMaterial color={dark} /></mesh>
      <mesh position={[0.9, 0.5, 0.8]}><boxGeometry args={[0.1, 0.7, 0.1]} /><meshLambertMaterial color={dark} /></mesh>
      <mesh position={[-0.9, 0.5, -0.8]}><boxGeometry args={[0.1, 0.7, 0.1]} /><meshLambertMaterial color={dark} /></mesh>
      <mesh position={[0.9, 0.5, -0.8]}><boxGeometry args={[0.1, 0.7, 0.1]} /><meshLambertMaterial color={dark} /></mesh>
      <mesh position={[0, 1.2, 0.3]}><sphereGeometry args={[1.1, 16, 12]} /><meshLambertMaterial color={body} /></mesh>
      <mesh position={[0, 1.3, 1.1]}><sphereGeometry args={[0.8, 16, 12]} /><meshLambertMaterial color="#5dade2" /></mesh>
      <mesh position={[0, 1.4, -2.0]}><boxGeometry args={[0.3, 0.3, 2.8]} /><meshLambertMaterial color={body} /></mesh>
      <mesh position={[0, 1.9, -3.2]}><boxGeometry args={[0.15, 0.9, 0.5]} /><meshLambertMaterial color={body} /></mesh>
      <mesh position={[0, 2.35, 0.3]}><cylinderGeometry args={[0.12, 0.12, 0.4, 8]} /><meshLambertMaterial color={dark} /></mesh>
      <group ref={mainRotor} position={[0, 2.6, 0.3]}>
        <mesh><boxGeometry args={[7, 0.05, 0.35]} /><meshLambertMaterial color="#1c1c1f" /></mesh>
        <mesh rotation={[0, Math.PI / 2, 0]}><boxGeometry args={[7, 0.05, 0.35]} /><meshLambertMaterial color="#1c1c1f" /></mesh>
      </group>
      <group ref={tailRotor} position={[0.25, 1.9, -3.3]}>
        <mesh><boxGeometry args={[0.05, 1.6, 0.18]} /><meshLambertMaterial color="#1c1c1f" /></mesh>
      </group>
    </group>
  )
}

export default function Helipad({ position = [0, 0, 0], deckR = 26 }: Props) {
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
      {/* helikopter (büyük) */}
      <group position={[0, padY, 0]} scale={1.8}>
        <Helicopter />
      </group>
    </group>
  )
}
