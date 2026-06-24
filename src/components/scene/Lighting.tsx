interface Props { night?: boolean }

export default function Lighting({ night = false }: Props) {
  return (
    <>
      <ambientLight intensity={night ? 0.18 : 0.6} color={night ? '#33405e' : '#ffffff'} />
      <directionalLight
        position={night ? [-80, 120, -60] : [100, 150, 80]}
        intensity={night ? 0.35 : 1.8}
        color={night ? '#9fb6ff' : '#ffffff'}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={400}
        shadow-camera-left={-160}
        shadow-camera-right={160}
        shadow-camera-top={160}
        shadow-camera-bottom={-160}
      />
      <hemisphereLight args={[night ? '#1a2540' : '#87ceeb', night ? '#0e1a12' : '#5a8a3c', night ? 0.15 : 0.3]} />
    </>
  )
}
