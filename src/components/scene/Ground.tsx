import { useMemo } from 'react'
import * as THREE from 'three'
import { islandRadius, ISLAND_MAX_R, BEACH_WIDTH } from '../../constants/cityLayout'

const COAST_SEGMENTS = 240

// Organik ada kıyısının kapalı şekli. `extra` çim kıyısına EKLENEN yarıçap
// (kumsal için dışa doğru). extra=0 → çim kıyısı.
function islandShape(extra = 0): THREE.Shape {
  const s = new THREE.Shape()
  for (let i = 0; i <= COAST_SEGMENTS; i++) {
    const a = (i / COAST_SEGMENTS) * Math.PI * 2
    const r = islandRadius(a) + extra
    const x = Math.cos(a) * r
    const y = Math.sin(a) * r   // shape Y → dünya Z (mesh -90° X döndürülür)
    if (i === 0) s.moveTo(x, y)
    else s.lineTo(x, y)
  }
  return s
}

function makeGrassTexture(): THREE.CanvasTexture {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!

  // base fill
  ctx.fillStyle = '#4e6b35'
  ctx.fillRect(0, 0, size, size)

  // noise patches for variety
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const r = 1 + Math.random() * 4
    const l = (Math.random() - 0.5) * 28
    const base = [78 + l, 107 + l, 53 + l].map(v => Math.max(0, Math.min(255, v)))
    ctx.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  // subtle grid lines (dirt paths feel)
  ctx.strokeStyle = 'rgba(40,55,20,0.08)'
  ctx.lineWidth = 1
  for (let x = 0; x < size; x += 32) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke()
  }
  for (let y = 0; y < size; y += 32) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke()
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(30, 30)   // tile over round ground
  return tex
}

export default function Ground() {
  const texture = useMemo(() => makeGrassTexture(), [])

  const grassMat = useMemo(() => {
    const m = new THREE.MeshLambertMaterial({ map: texture })
    return m
  }, [texture])

  // Çim zemin = organik ada şekli (DEĞİŞMEDİ, küçülmedi)
  const groundGeo = useMemo(() => {
    const g = new THREE.ShapeGeometry(islandShape(0), 8)
    const pos = g.attributes.position
    const uv: number[] = []
    const R = ISLAND_MAX_R * 2
    for (let i = 0; i < pos.count; i++) {
      uv.push((pos.getX(i) + R / 2) / R, (pos.getY(i) + R / 2) / R)
    }
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    g.attributes.uv.needsUpdate = true
    return g
  }, [])

  // Kumsal: çim kıyısından DIŞA, denize doğru eklenen halka (çimle çakışmaz)
  const beachGeo = useMemo(() => {
    const outer = islandShape(BEACH_WIDTH)
    outer.holes.push(islandShape(0) as unknown as THREE.Path)
    return new THREE.ShapeGeometry(outer, 8)
  }, [])

  return (
    <>
      {/* kumsal en altta (deniz seviyesine yakın), çimin DIŞINDA */}
      <mesh geometry={beachGeo} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <meshLambertMaterial color="#d9c89a" />
      </mesh>
      {/* çim üstte, ayrı y düzleminde → z-fighting yok */}
      <mesh geometry={groundGeo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow material={grassMat} />
    </>
  )
}
