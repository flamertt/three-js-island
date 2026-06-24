import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import * as THREE from 'three'

export interface PersonSpec {
  url: string
  x: number; z: number
  rot: number
  scale: number
  footY: number      // taban ofseti (model miny'ye göre)
  speed: number      // birim/sn (0 → sadece dur/idle)
  leash: number      // başlangıç noktasından max uzaklaşma
}

export default function AnimatedPerson({ spec }: { spec: PersonSpec }) {
  const group = useRef<THREE.Group>(null!)
  const { scene, animations } = useGLTF(spec.url)
  // Skinned mesh → her örnek için iskeletiyle klonla
  const cloned = useMemo(() => skeletonClone(scene), [scene])
  const { actions } = useAnimations(animations, group)

  // yürüyenler 'walk', duranlar 'idle'
  const clipName = spec.speed > 0 ? 'walk' : 'idle'
  useEffect(() => {
    const act = actions[clipName] ?? actions['idle'] ?? Object.values(actions)[0]
    act?.reset().fadeIn(0.2).play()
    return () => { act?.fadeOut(0.2) }
  }, [actions, clipName])

  const heading = useRef(spec.rot)
  const pos = useRef(new THREE.Vector3(spec.x, spec.footY, spec.z))
  const origin = useMemo(() => new THREE.Vector2(spec.x, spec.z), [spec.x, spec.z])

  useFrame((_, dt) => {
    if (!group.current) return
    const d = Math.min(dt, 0.05)
    if (spec.speed > 0) {
      const dirX = Math.sin(heading.current)
      const dirZ = Math.cos(heading.current)
      pos.current.x += dirX * spec.speed * d
      pos.current.z += dirZ * spec.speed * d
      // leash dışına çıkınca geri dön
      const dx = pos.current.x - origin.x
      const dz = pos.current.z - origin.y
      if (Math.hypot(dx, dz) > spec.leash) {
        heading.current += Math.PI + (Math.random() - 0.5) * 0.6
      }
      group.current.position.set(pos.current.x, spec.footY, pos.current.z)
      group.current.rotation.y = heading.current
    } else {
      group.current.position.set(spec.x, spec.footY, spec.z)
      group.current.rotation.y = spec.rot
    }
  })

  return (
    <group ref={group} scale={spec.scale}>
      <primitive object={cloned} />
    </group>
  )
}
