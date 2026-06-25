import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import * as THREE from 'three'
import { charB } from '../../assets/models'
import { islandRadius } from '../../constants/cityLayout'
import { vehiclePositions, getHijacked } from '../../utils/traffic'

export interface Obstacle { x: number; z: number; r: number; h: number }
export type Prompt = null | 'heli' | 'car'

// 3. şahıs oynanabilir karakter: WASD yürü/koş (Shift), Space zıpla.
// Kamera karakterin arkasından takip eder; OrbitControls kapalıyken aktif.

const SCALE = 0.45           // NPC yayalarla aynı boy (~4 birim insan)
const FOOT = SCALE * 1        // model tabanı (MODEL_MINY = -1)
const WALK_SPEED = 13
const RUN_SPEED = 22
const GRAVITY = -45
const JUMP_V = 15
const PLAYER_R = 0.3        // çarpışma yarıçapı (dar → aralardan geçebilir)
const VEHICLE_R = 1.8       // araç çarpışma yarıçapı
const BOARD_DIST = 16       // helipad merkezine bu mesafede E ile bin
const CAR_BOARD_DIST = 6    // arabaya bu mesafede F ile bin

export default function Player({
  start = [0, 50] as [number, number],
  obstacles = [],
  onBoardHeli,
  onBoardCar,
  onPromptChange,
}: {
  start?: [number, number]
  obstacles?: Obstacle[]
  onBoardHeli?: () => void
  onBoardCar?: (index: number, x: number, z: number, rot: number, url: string) => void
  onPromptChange?: (p: Prompt) => void
}) {
  const group = useRef<THREE.Group>(null!)
  const { scene, animations } = useGLTF(charB)
  const cloned = useMemo(() => skeletonClone(scene), [scene])
  const { actions } = useAnimations(animations, group)
  const { camera } = useThree()

  const keys = useRef<Record<string, boolean>>({})
  const pos = useRef(new THREE.Vector3(start[0], FOOT, start[1]))
  const obstRef = useRef(obstacles)
  obstRef.current = obstacles
  const onBoardRef = useRef(onBoardHeli)
  onBoardRef.current = onBoardHeli
  const onBoardCarRef = useRef(onBoardCar)
  onBoardCarRef.current = onBoardCar
  const onPromptRef = useRef(onPromptChange)
  onPromptRef.current = onPromptChange
  const promptRef = useRef<Prompt>(null)
  // en yakın binilebilir araba {index,x,z,rot,url} | null
  const nearCarRef = useRef<{ i: number; x: number; z: number; rot: number; url: string } | null>(null)

  // mod kapanırken yazıyı temizle
  useEffect(() => () => onPromptRef.current?.(null), [])
  const vy = useRef(0)
  const heading = useRef(0)
  const camYaw = useRef(0)
  const moving = useRef(false)

  // klavye
  useEffect(() => {
    const SCROLL_KEYS = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']
    const dn = (e: KeyboardEvent) => {
      keys.current[e.code] = true
      if (SCROLL_KEYS.includes(e.code)) e.preventDefault()
      // helipad merkezine yakınsa E ile helikoptere bin
      if (e.code === 'KeyE') {
        if (Math.hypot(pos.current.x, pos.current.z) < BOARD_DIST) {
          onBoardRef.current?.()
        }
      }
      // yakındaki arabaya F ile bin
      if (e.code === 'KeyF' && nearCarRef.current) {
        const c = nearCarRef.current
        onBoardCarRef.current?.(c.i, c.x, c.z, c.rot, c.url)
      }
    }
    const up = (e: KeyboardEvent) => { keys.current[e.code] = false }
    window.addEventListener('keydown', dn)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', dn)
      window.removeEventListener('keyup', up)
    }
  }, [])

  // başlangıç animasyonu
  useEffect(() => {
    const idle = actions['idle'] ?? Object.values(actions)[0]
    idle?.reset().fadeIn(0.2).play()
  }, [actions])

  const tmpFwd = useMemo(() => new THREE.Vector3(), [])
  const tmpRight = useMemo(() => new THREE.Vector3(), [])
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const camPos = useMemo(() => new THREE.Vector3(), [])

  useFrame((_, dtRaw) => {
    if (!group.current) return
    const dt = Math.min(dtRaw, 0.05)
    const k = keys.current

    // kamera yönüne göre hareket ekseni (yatay)
    camera.getWorldDirection(tmpFwd)
    tmpFwd.y = 0
    if (tmpFwd.lengthSq() < 1e-6) tmpFwd.set(0, 0, -1)
    tmpFwd.normalize()
    tmpRight.crossVectors(tmpFwd, up).normalize()

    const move = new THREE.Vector3()
    if (k['KeyW'] || k['ArrowUp']) move.add(tmpFwd)
    if (k['KeyS'] || k['ArrowDown']) move.sub(tmpFwd)
    if (k['KeyD'] || k['ArrowRight']) move.add(tmpRight)
    if (k['KeyA'] || k['ArrowLeft']) move.sub(tmpRight)

    const isMoving = move.lengthSq() > 0
    if (isMoving) {
      move.normalize()
      heading.current = Math.atan2(move.x, move.z)
    }
    const speed = (k['ShiftLeft'] || k['ShiftRight']) ? RUN_SPEED : WALK_SPEED
    pos.current.x += move.x * speed * dt
    pos.current.z += move.z * speed * dt

    // çarpışma: binalar (statik) + araçlar (canlı) içine giremez → dışarı it
    for (let pass = 0; pass < 2; pass++) {
      for (const o of obstRef.current) {
        const dx = pos.current.x - o.x, dz = pos.current.z - o.z
        const minD = o.r + PLAYER_R
        const dd = Math.hypot(dx, dz)
        if (dd < minD && dd > 1e-4) {
          const push = (minD - dd) / dd
          pos.current.x += dx * push
          pos.current.z += dz * push
        }
      }
      for (const v of vehiclePositions) {
        if (!v || !v.active) continue
        const dx = pos.current.x - v.x, dz = pos.current.z - v.z
        const minD = VEHICLE_R + PLAYER_R
        const dd = Math.hypot(dx, dz)
        if (dd < minD && dd > 1e-4) {
          const push = (minD - dd) / dd
          pos.current.x += dx * push
          pos.current.z += dz * push
        }
      }
    }

    // adayı sınırla (kıyıda kal)
    const ang = Math.atan2(pos.current.z, pos.current.x)
    const maxR = islandRadius(ang) - 4
    const d = Math.hypot(pos.current.x, pos.current.z)
    if (d > maxR) { pos.current.x *= maxR / d; pos.current.z *= maxR / d }

    // zıplama + yerçekimi
    const grounded = pos.current.y <= FOOT + 0.01
    if (grounded && (k['Space'])) vy.current = JUMP_V
    vy.current += GRAVITY * dt
    pos.current.y += vy.current * dt
    if (pos.current.y < FOOT) { pos.current.y = FOOT; vy.current = 0 }

    group.current.position.copy(pos.current)
    group.current.rotation.y = heading.current

    // yakınlık → bilgi balonu. Helipad öncelikli, sonra en yakın araba.
    const nearHeli = Math.hypot(pos.current.x, pos.current.z) < BOARD_DIST
    let car: typeof nearCarRef.current = null
    if (!nearHeli) {
      let best = CAR_BOARD_DIST
      const hj = getHijacked()
      for (let i = 0; i < vehiclePositions.length; i++) {
        const v = vehiclePositions[i]
        if (!v || !v.active || i === hj) continue
        const dd = Math.hypot(pos.current.x - v.x, pos.current.z - v.z)
        if (dd < best) { best = dd; car = { i, x: v.x, z: v.z, rot: v.rot, url: v.url } }
      }
    }
    nearCarRef.current = car
    const prompt: Prompt = nearHeli ? 'heli' : car ? 'car' : null
    if (prompt !== promptRef.current) {
      promptRef.current = prompt
      onPromptRef.current?.(prompt)
    }

    // animasyon değişimi
    if (isMoving !== moving.current) {
      moving.current = isMoving
      const walk = actions['walk']
      const idle = actions['idle'] ?? Object.values(actions)[0]
      if (isMoving) { idle?.fadeOut(0.15); walk?.reset().fadeIn(0.15).play() }
      else { walk?.fadeOut(0.15); idle?.reset().fadeIn(0.15).play() }
    }

    // 3. şahıs kamera: karakterin arkasında yumuşak takip
    camYaw.current += (heading.current - camYaw.current) * Math.min(1, dt * 3)
    const dist = 9, height = 5
    camPos.set(
      pos.current.x - Math.sin(camYaw.current) * dist,
      pos.current.y + height,
      pos.current.z - Math.cos(camYaw.current) * dist,
    )
    camera.position.lerp(camPos, Math.min(1, dt * 6))
    camera.lookAt(pos.current.x, pos.current.y + 2.2, pos.current.z)
  })

  return (
    <group ref={group} scale={SCALE}>
      <primitive object={cloned} />
    </group>
  )
}
