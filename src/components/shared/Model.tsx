import { useMemo, useEffect } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

interface ModelProps {
  url: string
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: number | [number, number, number]
  glow?: boolean   // gece: pencere/cephe ışıması (binalar için)
}

export default function Model({
  url,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  glow,
}: ModelProps) {
  const { scene } = useGLTF(url)

  const cloned = useMemo(() => {
    const c = scene.clone(true)
    c.traverse((obj) => {
      const m = obj as THREE.Mesh
      if (m.isMesh) {
        m.castShadow = true
        m.receiveShadow = true
        // glow destekleyen modeller (binalar) → materyali klonla ki
        // emissive değişimi paylaşılan/cache materyali bozmasın
        if (glow !== undefined) {
          m.material = Array.isArray(m.material)
            ? m.material.map((mm) => mm.clone())
            : (m.material as THREE.Material).clone()
        }
      }
    })
    return c
  }, [scene, glow !== undefined])

  // Gece açık/kapalı → emissive (colormap'i ışıt; pencereler parlar)
  useEffect(() => {
    if (glow === undefined) return
    cloned.traverse((obj) => {
      const m = obj as THREE.Mesh
      if (!m.isMesh) return
      const mats = Array.isArray(m.material) ? m.material : [m.material]
      for (const mat of mats) {
        const sm = mat as THREE.MeshStandardMaterial
        if (glow) {
          if (sm.map) sm.emissiveMap = sm.map
          sm.emissive = new THREE.Color('#ffdd99')
          sm.emissiveIntensity = 0.6
        } else {
          sm.emissiveIntensity = 0
        }
        sm.needsUpdate = true
      }
    })
  }, [cloned, glow])

  return <primitive object={cloned} position={position} rotation={rotation} scale={scale} />
}
