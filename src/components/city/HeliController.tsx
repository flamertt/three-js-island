import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import HelicopterModel from './HelicopterModel'
import { HELI_SCALE, HELI_PAD_Y } from './Helipad'
import { islandRadius } from '../../constants/cityLayout'
import type { Obstacle } from './Player'

// Pilotlu helikopter: W/S ileri-geri, A/D dön (yaw), Space yüksel, Shift alçal.
// Yere yakınken E ile in (onExit ile karaktere geri dönülür).

const H_SPEED = 34       // yatay hız
const V_SPEED = 22       // dikey hız
const YAW_SPEED = 1.6    // dönüş hızı (rad/sn)
const GROUND = HELI_PAD_Y
const EXIT_MAX_ALT = 4   // bu yükseklik altında E ile inilebilir
const HELI_R = 1.2       // helikopter çarpışma yarıçapı (dar → geniş yasak bölge yok)
const ROOF_CLEAR = 1     // bina çatısının bu kadar üstüne kadar çarpışma

export default function HeliController({
  start = [0, 0] as [number, number],
  obstacles = [],
  night = false,
  onExit,
}: {
  start?: [number, number]
  obstacles?: Obstacle[]
  night?: boolean
  onExit?: (x: number, z: number) => void
}) {
  const group = useRef<THREE.Group>(null!)
  const { camera } = useThree()

  const keys = useRef<Record<string, boolean>>({})
  const obstRef = useRef(obstacles)
  obstRef.current = obstacles
  const pos = useRef(new THREE.Vector3(start[0], GROUND, start[1]))
  const yaw = useRef(0)
  const camYaw = useRef(0)
  const pitch = useRef(0)
  const roll = useRef(0)
  const onExitRef = useRef(onExit)
  onExitRef.current = onExit

  useEffect(() => {
    const SCROLL_KEYS = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']
    const dn = (e: KeyboardEvent) => {
      keys.current[e.code] = true
      if (SCROLL_KEYS.includes(e.code)) e.preventDefault()
      if (e.code === 'KeyE') {
        // yere yakınsa in
        if (pos.current.y - GROUND < EXIT_MAX_ALT) {
          onExitRef.current?.(pos.current.x, pos.current.z)
        }
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

  const camPos = useMemo(() => new THREE.Vector3(), [])

  // gece arama feneri: spotlight hedefini aşağı/öne bağla
  const spotRef = useRef<THREE.SpotLight>(null!)
  const targetRef = useRef<THREE.Object3D>(null!)
  useEffect(() => {
    if (spotRef.current && targetRef.current) spotRef.current.target = targetRef.current
  }, [night])

  useFrame((_, dtRaw) => {
    if (!group.current) return
    const dt = Math.min(dtRaw, 0.05)
    const k = keys.current

    // dönüş
    if (k['KeyA'] || k['ArrowLeft']) yaw.current += YAW_SPEED * dt
    if (k['KeyD'] || k['ArrowRight']) yaw.current -= YAW_SPEED * dt

    // ileri/geri (burun yönünde)
    const fwd = k['KeyW'] || k['ArrowUp'] ? 1 : k['KeyS'] || k['ArrowDown'] ? -1 : 0
    pos.current.x += Math.sin(yaw.current) * fwd * H_SPEED * dt
    pos.current.z += Math.cos(yaw.current) * fwd * H_SPEED * dt

    // yükseklik
    if (k['Space']) pos.current.y += V_SPEED * dt
    if (k['ShiftLeft'] || k['ShiftRight']) pos.current.y -= V_SPEED * dt
    if (pos.current.y < GROUND) pos.current.y = GROUND
    if (pos.current.y > 160) pos.current.y = 160

    // binaya çarp: yalnızca o binanın çatısından AŞAĞIDAysan (üstünden serbest
    // uçar ve aralarına/açıklığa inebilirsin)
    for (const o of obstRef.current) {
      if (pos.current.y > o.h + ROOF_CLEAR) continue
      const dx = pos.current.x - o.x, dz = pos.current.z - o.z
      const minD = o.r + HELI_R
      const dd = Math.hypot(dx, dz)
      if (dd < minD && dd > 1e-4) {
        const push = (minD - dd) / dd
        pos.current.x += dx * push
        pos.current.z += dz * push
      }
    }

    // ada üstünde kal (yatay sınır geniş — deniz üstünde de uçulabilsin)
    const ang = Math.atan2(pos.current.z, pos.current.x)
    const maxR = islandRadius(ang) + 240
    const d = Math.hypot(pos.current.x, pos.current.z)
    if (d > maxR) { pos.current.x *= maxR / d; pos.current.z *= maxR / d }

    // hafif eğim (his) — ileri pitch, dönüşte roll
    const targetPitch = fwd * 0.18
    const targetRoll = ((k['KeyA'] ? 1 : 0) - (k['KeyD'] ? 1 : 0)) * 0.18
    pitch.current += (targetPitch - pitch.current) * Math.min(1, dt * 4)
    roll.current += (targetRoll - roll.current) * Math.min(1, dt * 4)

    group.current.position.copy(pos.current)
    group.current.rotation.set(pitch.current, yaw.current, roll.current)

    // kamera: arkadan ve yukarıdan takip
    camYaw.current += (yaw.current - camYaw.current) * Math.min(1, dt * 3)
    const dist = 24, height = 11
    camPos.set(
      pos.current.x - Math.sin(camYaw.current) * dist,
      pos.current.y + height,
      pos.current.z - Math.cos(camYaw.current) * dist,
    )
    camera.position.lerp(camPos, Math.min(1, dt * 5))
    camera.lookAt(pos.current.x, pos.current.y + 3, pos.current.z)
  })

  return (
    <group ref={group}>
      <group scale={HELI_SCALE}>
        <HelicopterModel spin={2} night={night} />
      </group>

      {night && (
        <>
          {/* aşağı/öne bakan arama feneri — zemini aydınlatır */}
          <spotLight
            ref={spotRef}
            position={[0, 0.5, 1.5]}
            angle={0.5}
            penumbra={0.5}
            intensity={900}
            distance={260}
            decay={1.1}
            color="#fff3cf"
          />
          <object3D ref={targetRef} position={[0, -60, 18]} />
        </>
      )}
    </group>
  )
}
