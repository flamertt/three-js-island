import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const VERT = /* glsl */`
  uniform float uTime;
  varying vec3  vWorldPos;
  varying float vElevation;

  // Gerstner-ish dalga toplamı — height + tangent türevi normal için
  vec3 wave(vec2 p, vec2 dir, float amp, float k, float speed, float t) {
    float phase = dot(dir, p) * k + t * speed;
    float c = cos(phase);
    float s = sin(phase);
    // height (y), dHeight/dx, dHeight/dz
    return vec3(amp * s, amp * k * dir.x * c, amp * k * dir.y * c);
  }

  void main() {
    vec3 pos = position;
    vec2 p = pos.xy;

    vec3 w1 = wave(p, normalize(vec2( 1.0,  0.35)), 1.3, 0.045, 1.20, uTime);
    vec3 w2 = wave(p, normalize(vec2(-0.6,  0.9 )), 0.9, 0.075, 1.55, uTime);
    vec3 w3 = wave(p, normalize(vec2( 0.2, -1.0 )), 0.6, 0.12,  1.95, uTime);
    vec3 w4 = wave(p, normalize(vec2( 0.85, 0.55)), 0.35,0.22,  2.6,  uTime);

    float h  = w1.x + w2.x + w3.x + w4.x;
    float dx = w1.y + w2.y + w3.y + w4.y;
    float dz = w1.z + w2.z + w3.z + w4.z;

    pos.z += h;
    vElevation = h;

    // tangent uzayında normal — local Z, rotation [-PI/2,0,0] sonrası world Y
    vec3 nLocal = normalize(vec3(-dx, -dz, 1.0));
    // -90° X rotasyonu: (x, y, z) → (x, -z, y) — normali world frame'e taşı
    vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;
    // world normali frag'da yeniden hesaplamayalım, vWorldPos ile yetinelim
    vWorldPos.y += 0.0001 * nLocal.x; // dummy use to silence lints
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

const FRAG = /* glsl */`
  uniform float uTime;
  uniform vec3  uSunDir;
  uniform vec3  uCamPos;
  varying vec3  vWorldPos;
  varying float vElevation;

  // hash + value noise — küçük detay için
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p){
    vec2 i = floor(p); vec2 f = fract(p);
    float a = hash(i), b = hash(i+vec2(1,0)), c = hash(i+vec2(0,1)), d = hash(i+vec2(1,1));
    vec2 u = f*f*(3.0-2.0*f);
    return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
  }
  // fractal brownian motion — yumuşak çok-oktavlı köpük dokusu
  float fbm(vec2 p){
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * vnoise(p);
      p = p * 2.02 + 11.3;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    // Yüzey normalini world-pozisyon türevinden çıkar — pürüzlü dalga görünümü
    vec3 dPdx = dFdx(vWorldPos);
    vec3 dPdz = dFdy(vWorldPos);
    vec3 N = normalize(cross(dPdz, dPdx));
    if (N.y < 0.0) N = -N;

    // micro detay normal — çok küçük çırpıntı
    vec2 uvN = vWorldPos.xz * 0.15 + vec2(uTime * 0.08, uTime * 0.05);
    float n1 = fbm(uvN);
    float n2 = fbm(uvN * 2.3 + 17.0);
    vec3 microN = normalize(vec3((n1 - 0.5), 0.0, (n2 - 0.5)) * 0.6 + vec3(0.0, 1.0, 0.0));
    N = normalize(N + microN * 0.35);

    vec3 V = normalize(uCamPos - vWorldPos);
    vec3 L = normalize(uSunDir);
    vec3 H = normalize(L + V);

    // Renk: derinlik + bakış açısına göre fresnel
    vec3 deep    = vec3(0.015, 0.07, 0.18);
    vec3 shallow = vec3(0.08,  0.30, 0.55);
    vec3 sky     = vec3(0.55,  0.78, 0.95);

    float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
    vec3 base = mix(deep, shallow, 0.55 + 0.45 * N.y);
    vec3 col  = mix(base, sky, fres * 0.85);

    // Güneş yansıması — keskin specular
    float spec = pow(max(dot(N, H), 0.0), 90.0);
    col += vec3(1.0, 0.93, 0.78) * spec * 1.3;

    // Foam — yüksek frekanslı fbm dokusu, dalga tepelerinde yoğunlaşır.
    // İki katman (kayar) → animasyonlu köpük; yumuşak geçiş, blok/piksel yok.
    float crest = smoothstep(0.6, 2.2, vElevation);
    vec2 fuv = vWorldPos.xz * 0.06;
    float foamTex = fbm(fuv + vec2(uTime * 0.12, -uTime * 0.09)) * 0.6
                  + fbm(fuv * 2.7 - vec2(uTime * 0.18, uTime * 0.14)) * 0.4;
    // köpük yalnızca tepelerde ve doku eşiğinde belirsin
    float foam = crest * smoothstep(0.45, 0.75, foamTex);
    foam = clamp(foam, 0.0, 1.0);
    col = mix(col, vec3(0.92, 0.96, 1.0), foam * 0.85);

    gl_FragColor = vec4(col, 1.0);
  }
`

export default function Ocean() {
  const matRef  = useRef<THREE.ShaderMaterial>(null!)

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime:   { value: 0 },
          uSunDir: { value: new THREE.Vector3(200, 120, 60).normalize() },
          uCamPos: { value: new THREE.Vector3() },
        },
        vertexShader: VERT,
        fragmentShader: FRAG,
        extensions: { derivatives: true } as any,
        side: THREE.FrontSide,
      }),
    [],
  )

  useFrame(({ clock, camera }) => {
    material.uniforms.uTime.value = clock.getElapsedTime()
    ;(material.uniforms.uCamPos.value as THREE.Vector3).copy(camera.position)
  })

  return (
    <mesh
      ref={matRef as any}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -3, 0]}
      material={material}
    >
      <planeGeometry args={[1800, 1600, 220, 200]} />
    </mesh>
  )
}
