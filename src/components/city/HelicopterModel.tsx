import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Prosedürel helikopter görseli (dönen ana/kuyruk rotoru). Hem helipad
// dekoru hem de pilotlu uçuş kontrolcüsü bunu kullanır.
export default function HelicopterModel({ spin = 1 }: { spin?: number }) {
  const mainRotor = useRef<THREE.Group>(null!)
  const tailRotor = useRef<THREE.Group>(null!)
  useFrame((_, dt) => {
    if (mainRotor.current) mainRotor.current.rotation.y += dt * 9 * spin
    if (tailRotor.current) tailRotor.current.rotation.x += dt * 14 * spin
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
