import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useVisibility } from '../../hooks/useVisibility'

// ---------- shape generators: each returns Float32Array(count * 3) ----------

function textShape(text, count) {
  const W = 1400, H = 320
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const g = c.getContext('2d')
  g.fillStyle = '#fff'
  g.font = '900 250px Inter, Arial, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(text, W / 2, H / 2)
  const data = g.getImageData(0, 0, W, H).data
  const pts = []
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (data[(y * W + x) * 4 + 3] > 128) pts.push(x, y)
  const out = new Float32Array(count * 3)
  const scale = 9 / W
  for (let i = 0; i < count; i++) {
    const k = ((Math.random() * pts.length) / 2 | 0) * 2
    out[i * 3] = (pts[k] - W / 2) * scale + (Math.random() - 0.5) * 0.02
    out[i * 3 + 1] = -(pts[k + 1] - H / 2) * scale + (Math.random() - 0.5) * 0.02
    out[i * 3 + 2] = (Math.random() - 0.5) * 0.35
  }
  return out
}

function sphereShape(count) {
  const out = new Float32Array(count * 3)
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2
    const rad = Math.sqrt(1 - y * y)
    const th = golden * i
    const r = 2.2 + (Math.random() - 0.5) * 0.08
    out[i * 3] = Math.cos(th) * rad * r
    out[i * 3 + 1] = y * r
    out[i * 3 + 2] = Math.sin(th) * rad * r
  }
  return out
}

function knotShape(count) {
  const geo = new THREE.TorusKnotGeometry(1.5, 0.42, 420, 36, 2, 3)
  const pos = geo.attributes.position.array
  const n = pos.length / 3
  const out = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const k = (Math.random() * n) | 0
    out[i * 3] = pos[k * 3] + (Math.random() - 0.5) * 0.05
    out[i * 3 + 1] = pos[k * 3 + 1] + (Math.random() - 0.5) * 0.05
    out[i * 3 + 2] = pos[k * 3 + 2] + (Math.random() - 0.5) * 0.05
  }
  geo.dispose()
  return out
}

function galaxyShape(count) {
  const out = new Float32Array(count * 3)
  const arms = 3
  const randn = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5
  for (let i = 0; i < count; i++) {
    const r = Math.pow(Math.random(), 1.6) * 3.8 + 0.08
    const a = ((i % arms) / arms) * Math.PI * 2 + r * 1.25 + (randn() * 0.35) / (r * 0.6 + 0.4)
    out[i * 3] = Math.cos(a) * r
    out[i * 3 + 1] = randn() * 0.18 * (1.2 - r / 3.8)
    out[i * 3 + 2] = Math.sin(a) * r
  }
  return out
}

// ---------- shaders ----------

const VERT = /* glsl */ `
attribute vec3 aFrom;
attribute vec3 aTo;
attribute float aRand;
uniform float uProgress;
uniform float uTime;
uniform vec3 uMouse;
uniform float uSize;
varying float vRand;
varying float vGlow;

vec3 swirl(vec3 p, float t) {
  return vec3(sin(p.y * 1.7 + t + aRand * 6.0),
              sin(p.z * 1.9 + t * 1.3 + aRand * 4.0),
              sin(p.x * 1.5 + t * 0.8 + aRand * 5.0));
}

void main() {
  // staggered, eased morph — each particle starts at a slightly different time
  float local = clamp((uProgress - aRand * 0.35) / 0.65, 0.0, 1.0);
  float e = local < 0.5 ? 4.0 * local * local * local : 1.0 - pow(-2.0 * local + 2.0, 3.0) / 2.0;
  vec3 pos = mix(aFrom, aTo, e);
  float mid = sin(e * 3.14159);
  pos += swirl(pos * 0.8, uTime) * mid * 0.9;     // turbulent flight between shapes
  pos += swirl(pos * 2.0, uTime * 0.5) * 0.025;   // idle shimmer

  vec4 world = modelMatrix * vec4(pos, 1.0);
  vec3 dir = world.xyz - uMouse;
  float d = length(dir);
  float push = smoothstep(1.5, 0.0, d);
  world.xyz += normalize(dir + 1e-4) * push * 0.9;

  vGlow = push + mid * 0.6;
  vRand = aRand;
  vec4 mv = viewMatrix * world;
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * (0.6 + aRand * 0.8) * (1.0 + vGlow) / -mv.z;
}`

const FRAG = /* glsl */ `
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
varying float vRand;
varying float vGlow;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  a *= a;
  vec3 col = mix(uColorA, uColorB, vRand);
  col = mix(col, uColorC, clamp(vGlow, 0.0, 1.0));
  gl_FragColor = vec4(col * a, a);
}`

const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

/**
 * Thousands of GPU particles that morph between text and 3D shapes.
 * Click to advance; particles flee the cursor.
 */
export default function ParticleMorph({
  words = ['MOTION', 'MORPH'],
  count = 18000,
  interval = 4.2,
  colors = ['#7c5cff', '#22d3ee', '#ff4fd8'],
}) {
  const mountRef = useRef(null)
  const visible = useVisibility(mountRef)
  const wordsKey = words.join('|')
  const colorsKey = colors.join('|')

  useEffect(() => {
    const mount = mountRef.current
    let disposed = false
    let cleanup = () => {}

    document.fonts.load('900 250px Inter').finally(() => {
      if (disposed) return
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      mount.appendChild(renderer.domElement)
      renderer.domElement.className = 'fx-canvas'

      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
      camera.position.set(0, 0, 9)

      const shapes = [
        textShape(wordsKey.split('|')[0], count),
        sphereShape(count),
        knotShape(count),
        galaxyShape(count),
        ...wordsKey.split('|').slice(1).map(w => textShape(w, count)),
      ]

      const geo = new THREE.BufferGeometry()
      const rand = new Float32Array(count).map(() => Math.random())
      geo.setAttribute('position', new THREE.BufferAttribute(shapes[0].slice(), 3))
      geo.setAttribute('aFrom', new THREE.BufferAttribute(shapes[0].slice(), 3))
      geo.setAttribute('aTo', new THREE.BufferAttribute(shapes[0].slice(), 3))
      geo.setAttribute('aRand', new THREE.BufferAttribute(rand, 1))
      geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 10)

      const uniforms = {
        uProgress: { value: 1 },
        uTime: { value: 0 },
        uMouse: { value: new THREE.Vector3(99, 99, 99) },
        uSize: { value: 38 * renderer.getPixelRatio() },
        uColorA: { value: new THREE.Color(colorsKey.split('|')[0]) },
        uColorB: { value: new THREE.Color(colorsKey.split('|')[1]) },
        uColorC: { value: new THREE.Color(colorsKey.split('|')[2]) },
      }
      const mat = new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: FRAG, uniforms,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      })
      const points = new THREE.Points(geo, mat)
      scene.add(points)

      let shapeIdx = 0
      let morphStart = -1
      let lastMorph = 0
      const clock = new THREE.Clock()
      const advance = () => {
        if (uniforms.uProgress.value < 1) return
        geo.attributes.aFrom.array.set(shapes[shapeIdx])
        shapeIdx = (shapeIdx + 1) % shapes.length
        geo.attributes.aTo.array.set(shapes[shapeIdx])
        geo.attributes.aFrom.needsUpdate = true
        geo.attributes.aTo.needsUpdate = true
        morphStart = clock.getElapsedTime()
        lastMorph = morphStart
        uniforms.uProgress.value = 0
      }

      const ndc = new THREE.Vector2(9, 9)
      const target = { x: 0, y: 0 }
      const ray = new THREE.Raycaster()
      const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
      const hit = new THREE.Vector3()
      const onMove = e => {
        const r = renderer.domElement.getBoundingClientRect()
        ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
        target.x = ndc.x
        target.y = ndc.y
      }
      const onLeave = () => { ndc.set(9, 9); target.x = 0; target.y = 0 }
      renderer.domElement.addEventListener('pointermove', onMove)
      renderer.domElement.addEventListener('pointerleave', onLeave)
      renderer.domElement.addEventListener('pointerdown', advance)

      const resize = () => {
        const { width, height } = mount.getBoundingClientRect()
        renderer.setSize(width, height, false)
        camera.aspect = width / height
        camera.position.z = width / height < 1.2 ? 13 : 9
        camera.updateProjectionMatrix()
      }
      resize()
      const ro = new ResizeObserver(resize)
      ro.observe(mount)

      let raf
      const loop = () => {
        raf = requestAnimationFrame(loop)
        if (!visible.current) return
        const t = clock.getElapsedTime()
        uniforms.uTime.value = t
        if (morphStart >= 0) uniforms.uProgress.value = Math.min(1, (t - morphStart) / 2.4)
        if (t - lastMorph > interval) advance()

        points.rotation.y += (target.x * 0.5 + Math.sin(t * 0.25) * 0.3 - points.rotation.y) * 0.04
        points.rotation.x += (-target.y * 0.3 - points.rotation.x) * 0.04
        if (shapeIdx === 3) points.rotation.x += (0.55 - points.rotation.x) * 0.03 // tilt the galaxy to show its arms

        if (ndc.x < 2) {
          ray.setFromCamera(ndc, camera)
          ray.ray.intersectPlane(plane, hit)
          uniforms.uMouse.value.lerp(hit, 0.25)
        } else {
          uniforms.uMouse.value.set(99, 99, 99)
        }
        renderer.render(scene, camera)
      }
      loop()

      cleanup = () => {
        cancelAnimationFrame(raf)
        ro.disconnect()
        geo.dispose()
        mat.dispose()
        renderer.dispose()
        renderer.forceContextLoss()
        renderer.domElement.remove()
      }
    })

    return () => { disposed = true; cleanup() }
  }, [wordsKey, count, interval, colorsKey, visible])

  return <div ref={mountRef} className="fx-mount" />
}
