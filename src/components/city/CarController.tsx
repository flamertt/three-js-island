import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { VEHICLE_SCALE, islandRadius } from '../../constants/cityLayout'
import type { Obstacle } from './Player'
import { vehiclePositions, getHijacked } from '../../utils/traffic'

// Sürülebilir araba: W gaz, S fren/geri, A/D direksiyon, F in.
const MAX_SPEED = 30
const ACCEL = 26
const REVERSE_SPEED = 12
const FRICTION = 14
const STEER = 2.2          // rad/sn (tam hızda)
const CAR_R = 2.0
const OTHER_CAR_R = 2.2    // diğer araçların çarpışma yarıçapı
const CAR_Y = 0.15         // tekerlekler yol yüzeyine otursun (model tabanı y=0)
const WHEEL_RADIUS = 0.3 * VEHICLE_SCALE
const MAX_STEER_VIS = 0.5  // ön tekerlek görsel dönüş açısı (rad)

export default function CarController({
  start = [0, 0] as [number, number],
  startRot = 0,
  url,
  obstacles = [],
  onExit,
}: {
  start?: [number, number]
  startRot?: number
  url: string
  obstacles?: Obstacle[]
  onExit?: (x: number, z: number) => void
}) {
  const group = useRef<THREE.Group>(null!)
  const { scene } = useGLTF(url)
  const cloned = useMemo(() => scene.clone(true), [scene])
  const { camera } = useThree()

  // tekerlek node'larını adıyla bul (ön = direksiyon, hepsi = yuvarlanma)
  const wheels = useMemo(() => {
    const front: THREE.Object3D[] = []
    const all: THREE.Object3D[] = []
    cloned.traverse((o) => {
      if (o.name.startsWith('wheel')) {
        o.rotation.order = 'YXZ'
        all.push(o)
        if (o.name.includes('front')) front.push(o)
      }
    })
    return { front, all }
  }, [cloned])
  const roll = useRef(0)

  const keys = useRef<Record<string, boolean>>({})
  const pos = useRef(new THREE.Vector3(start[0], 0, start[1]))
  const yaw = useRef(startRot)
  const speed = useRef(0)            // ileri hız (teker yuvarlanması için)
  const vel = useRef(new THREE.Vector2(0, 0))  // dünya hız vektörü (vx, vz)
  const camYaw = useRef(startRot)
  const obstRef = useRef(obstacles)
  obstRef.current = obstacles
  const onExitRef = useRef(onExit)
  onExitRef.current = onExit

  useEffect(() => {
    const dn = (e: KeyboardEvent) => {
      keys.current[e.code] = true
      if (e.code === 'KeyF') onExitRef.current?.(pos.current.x, pos.current.z)
    }
    const up = (e: KeyboardEvent) => { keys.current[e.code] = false }
    window.addEventListener('keydown', dn)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', dn)
      window.removeEventListener('keyup', up)
    }
  }, [])

  const camPos = useMemo(() => new THREE.Vector3(), [])

  useFrame((_, dtRaw) => {
    if (!group.current) return
    const dt = Math.min(dtRaw, 0.05)
    const k = keys.current

    const handbrake = !!k['Space']

    // yön eksenleri
    const fwx = Math.sin(yaw.current), fwz = Math.cos(yaw.current)   // ileri
    const rgx = fwz, rgz = -fwx                                       // sağ (dik)

    // hızı ileri/yanal bileşenlere ayır
    let fSpeed = vel.current.x * fwx + vel.current.y * fwz
    let lat = vel.current.x * rgx + vel.current.y * rgz

    // ivme / fren
    if (k['KeyW'] || k['ArrowUp']) fSpeed += ACCEL * dt
    else if (k['KeyS'] || k['ArrowDown']) fSpeed -= ACCEL * dt
    else {
      const f = FRICTION * dt
      fSpeed = Math.abs(fSpeed) < f ? 0 : fSpeed - Math.sign(fSpeed) * f
    }
    // el freni → ileri hızı da bir miktar kes
    if (handbrake) fSpeed *= Math.max(0, 1 - 1.6 * dt)
    fSpeed = Math.max(-REVERSE_SPEED, Math.min(MAX_SPEED, fSpeed))

    // yanal kavrama (grip): normalde yanal kayma hızlı söner; el freninde
    // grip düşer → araba yana kayar = DRIFT
    const grip = handbrake ? 1.1 : 7.5
    lat *= Math.max(0, 1 - grip * dt)

    // hız vektörünü yeniden kur
    vel.current.set(fwx * fSpeed + rgx * lat, fwz * fSpeed + rgz * lat)
    speed.current = fSpeed

    // direksiyon (hıza orantılı; el freninde daha keskin)
    const steerInput = (k['KeyA'] || k['ArrowLeft'] ? 1 : 0) - (k['KeyD'] || k['ArrowRight'] ? 1 : 0)
    const speedFactor = Math.min(1, Math.abs(fSpeed) / 8)
    const steerMul = handbrake ? 1.6 : 1
    yaw.current += steerInput * STEER * speedFactor * Math.sign(fSpeed || 1) * steerMul * dt

    // ilerle (hız vektörüyle → kayma korunur)
    pos.current.x += vel.current.x * dt
    pos.current.z += vel.current.y * dt

    // bina çarpışması → dışarı it (ve hızı kes)
    for (const o of obstRef.current) {
      const dx = pos.current.x - o.x, dz = pos.current.z - o.z
      const minD = o.r + CAR_R
      const dd = Math.hypot(dx, dz)
      if (dd < minD && dd > 1e-4) {
        const push = (minD - dd) / dd
        pos.current.x += dx * push
        pos.current.z += dz * push
        vel.current.multiplyScalar(0.3)
      }
    }

    // diğer araçlarla çarpışma → içinden geçme
    const hj = getHijacked()
    for (let i = 0; i < vehiclePositions.length; i++) {
      const v = vehiclePositions[i]
      if (!v || !v.active || i === hj) continue
      const dx = pos.current.x - v.x, dz = pos.current.z - v.z
      const minD = CAR_R + OTHER_CAR_R
      const dd = Math.hypot(dx, dz)
      if (dd < minD && dd > 1e-4) {
        const push = (minD - dd) / dd
        pos.current.x += dx * push
        pos.current.z += dz * push
        vel.current.multiplyScalar(0.4)
      }
    }

    // adada kal
    const ang = Math.atan2(pos.current.z, pos.current.x)
    const maxR = islandRadius(ang) - 3
    const d = Math.hypot(pos.current.x, pos.current.z)
    if (d > maxR) { pos.current.x *= maxR / d; pos.current.z *= maxR / d; vel.current.multiplyScalar(0.5) }

    group.current.position.set(pos.current.x, CAR_Y, pos.current.z)
    group.current.rotation.y = yaw.current

    // tekerlekler: yuvarlanma (hepsi) + direksiyon (ön)
    roll.current -= (speed.current / WHEEL_RADIUS) * dt
    for (const w of wheels.all) w.rotation.x = roll.current
    for (const w of wheels.front) w.rotation.y = steerInput * MAX_STEER_VIS

    // kamera arkadan takip
    camYaw.current += (yaw.current - camYaw.current) * Math.min(1, dt * 4)
    const dist = 12, height = 6
    camPos.set(
      pos.current.x - Math.sin(camYaw.current) * dist,
      pos.current.y + height,
      pos.current.z - Math.cos(camYaw.current) * dist,
    )
    camera.position.lerp(camPos, Math.min(1, dt * 6))
    camera.lookAt(pos.current.x, pos.current.y + 1.5, pos.current.z)
  })

  return (
    <group ref={group}>
      <primitive object={cloned} scale={VEHICLE_SCALE} />
    </group>
  )
}
