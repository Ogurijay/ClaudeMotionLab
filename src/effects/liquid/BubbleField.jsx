import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useVisibility } from '../../hooks/useVisibility'
import { adaptiveRenderer } from '../../lib/perf'

const VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vView;
varying vec3 vPos;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vView = normalize(cameraPosition - world.xyz);
  vPos = position;
  gl_Position = projectionMatrix * viewMatrix * world;
}`

// thin-film interference: film thickness swirls over the surface, the reflected
// colour comes from the optical path difference, strongest at grazing angles
const FRAG = /* glsl */ `
uniform float uTime;
uniform float uSeed;
uniform float uFade;
varying vec3 vN;
varying vec3 vView;
varying vec3 vPos;

vec3 spectrum(float t) {
  return 0.5 + 0.5 * cos(6.2831 * (t + vec3(0.0, 0.33, 0.67)));
}

void main() {
  vec3 n = normalize(vN);
  float ndv = clamp(dot(n, vView), 0.0, 1.0);
  float fres = pow(1.0 - ndv, 2.2);
  // swirling thickness, thinner toward the top as the film drains
  float swirl = sin(vPos.x * 5.0 + uTime * 0.7 + uSeed) + sin(vPos.y * 6.0 - uTime * 0.5 + uSeed * 2.0) + sin((vPos.z + vPos.y) * 4.0 + uTime * 0.9);
  float thickness = 0.6 + 0.18 * swirl - vPos.y * 0.35;
  vec3 film = spectrum(thickness * 1.6 + ndv * 0.6);
  vec3 col = film * (0.25 + fres * 1.2);
  // window-like highlights
  vec3 L1 = normalize(vec3(-0.5, 0.7, 0.6)), L2 = normalize(vec3(0.6, -0.3, 0.5));
  col += pow(max(dot(reflect(-L1, n), vView), 0.0), 80.0) * 1.4;
  col += pow(max(dot(reflect(-L2, n), vView), 0.0), 40.0) * 0.35;
  float alpha = clamp(0.06 + fres * 0.85, 0.0, 1.0) * uFade;
  gl_FragColor = vec4(col * uFade, alpha);
}`

/**
 * Soap bubbles with thin-film interference colours drifting upward, swaying,
 * nudging each other and shying away from the cursor. Click one to pop it.
 */
export default function BubbleField({ count = 24 }) {
  const mountRef = useRef(null)
  const visible = useVisibility(mountRef)

  useEffect(() => {
    const mount = mountRef.current
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    const perf = adaptiveRenderer(renderer, 1.5, () => resize())
    renderer.domElement.className = 'fx-canvas'
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50)
    camera.position.set(0, 0, 10)
    const geo = new THREE.SphereGeometry(1, 48, 32)
    const MAX_DROPS = 1200
    const dropGeo = new THREE.BufferGeometry()
    const dropPos = new THREE.BufferAttribute(new Float32Array(MAX_DROPS * 3), 3)
    dropGeo.setAttribute('position', dropPos)
    dropGeo.setDrawRange(0, 0)
    const dropMat = new THREE.PointsMaterial({ color: 0xe0f7ff, size: 0.06, transparent: true, opacity: 0.9, depthWrite: false })

    let halfW = 6, halfH = 4
    const spawn = (b, bottom) => {
      b.r = 0.35 + Math.random() * 0.65
      b.pos.set((Math.random() - 0.5) * halfW * 1.8, bottom ? -halfH - b.r - Math.random() * 2 : (Math.random() - 0.5) * halfH * 2, (Math.random() - 0.5) * 3)
      b.vel.set((Math.random() - 0.5) * 0.004, 0.006 + Math.random() * 0.01, 0)
      b.popping = 0
      b.mesh.material.uniforms.uFade.value = 1
      b.mesh.visible = true
    }
    const bubbles = Array.from({ length: count }, (_, i) => {
      const mat = new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
        uniforms: { uTime: { value: 0 }, uSeed: { value: i * 1.7 }, uFade: { value: 1 } },
      })
      const mesh = new THREE.Mesh(geo, mat)
      scene.add(mesh)
      const b = { mesh, pos: new THREE.Vector3(), vel: new THREE.Vector3(), r: 1, popping: 0, phase: Math.random() * 6 }
      spawn(b, false)
      return b
    })
    const drops = new THREE.Points(dropGeo, dropMat)
    drops.frustumCulled = false   // positions change every frame; the static bounding sphere would cull them
    scene.add(drops)
    let dropData = []

    const ndc = new THREE.Vector2(9, 9)
    const ray = new THREE.Raycaster()
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
    const cursor = new THREE.Vector3(99, 99, 0)
    const setNdc = e => {
      const r = renderer.domElement.getBoundingClientRect()
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    }
    const onMove = e => { setNdc(e); ray.setFromCamera(ndc, camera); ray.ray.intersectPlane(plane, cursor) }
    const onLeave = () => cursor.set(99, 99, 0)
    const onDown = e => {
      setNdc(e)
      ray.setFromCamera(ndc, camera)
      const hits = ray.intersectObjects(bubbles.filter(b => !b.popping).map(b => b.mesh))
      const b = hits[0] && bubbles.find(x => x.mesh === hits[0].object)
      if (!b) return
      b.popping = 1
      for (let i = 0; i < 40; i++) {
        const d = new THREE.Vector3().randomDirection()
        dropData.push({ p: b.pos.clone().addScaledVector(d, b.r), v: d.multiplyScalar(0.04 + Math.random() * 0.05), life: 0 })
      }
    }
    renderer.domElement.addEventListener('pointermove', onMove)
    renderer.domElement.addEventListener('pointerleave', onLeave)
    renderer.domElement.addEventListener('pointerdown', onDown)

    const resize = () => {
      const { width, height } = mount.getBoundingClientRect()
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      halfH = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z
      halfW = halfH * camera.aspect
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(mount)

    const t0 = performance.now()
    // compile every material in the background before the first frame, so mounting
    // this effect mid-scroll doesn't stall the main thread on shader compilation
    let compiled = false
    renderer.compileAsync(scene, camera).catch(() => {}).finally(() => { compiled = true })
    let raf
    const loop = () => {
      raf = requestAnimationFrame(loop)
      if (!perf.frame(visible.current)) return
      if (!compiled) return
      const t = (performance.now() - t0) / 1000
      for (const b of bubbles) {
        b.mesh.material.uniforms.uTime.value = t
        if (b.popping) {
          b.popping += 1
          const k = b.popping / 10
          b.mesh.scale.setScalar(b.r * (1 + k * 0.25))
          b.mesh.material.uniforms.uFade.value = Math.max(0, 1 - k)
          if (k >= 1) { b.mesh.visible = false; if (b.popping > 90) spawn(b, true) }
          continue
        }
        // buoyancy, sway, cursor shyness
        b.vel.y += (0.012 - b.vel.y) * 0.01
        b.vel.x += Math.sin(t * 0.8 + b.phase) * 0.0004
        const toC = b.pos.clone().sub(cursor)
        const dc = toC.length()
        if (dc < b.r + 1.4) b.vel.addScaledVector(toC.normalize(), 0.004 * (1 - dc / (b.r + 1.4)))
        b.vel.multiplyScalar(0.985)
        b.pos.add(b.vel)
        if (b.pos.y - b.r > halfH + 0.5) spawn(b, true)
        if (Math.abs(b.pos.x) > halfW) b.vel.x -= Math.sign(b.pos.x) * 0.002
      }
      // soft collisions between bubbles
      for (let i = 0; i < count; i++) for (let j = i + 1; j < count; j++) {
        const a = bubbles[i], c = bubbles[j]
        if (a.popping || c.popping) continue
        const d = a.pos.clone().sub(c.pos), len = d.length(), min = a.r + c.r
        if (len < min && len > 1e-4) {
          d.multiplyScalar(((min - len) / len) * 0.5)
          a.pos.add(d); c.pos.sub(d)
        }
      }
      for (const b of bubbles) {
        if (b.popping) continue
        b.mesh.position.copy(b.pos)
        b.mesh.scale.set(b.r * (1 + Math.sin(t * 3 + b.phase) * 0.015), b.r * (1 - Math.sin(t * 3 + b.phase) * 0.015), b.r)
      }
      // droplets from popped bubbles
      dropData = dropData.filter(d => (d.life += 1) < 40).slice(-MAX_DROPS)
      dropData.forEach((d, i) => { d.v.y -= 0.002; d.p.add(d.v); dropPos.setXYZ(i, d.p.x, d.p.y, d.p.z) })
      dropPos.needsUpdate = true
      dropGeo.setDrawRange(0, dropData.length)
      renderer.render(scene, camera)
    }
    loop()

    return () => {
      cancelAnimationFrame(raf)
      perf.dispose()
      ro.disconnect()
      renderer.domElement.removeEventListener('pointermove', onMove)
      renderer.domElement.removeEventListener('pointerleave', onLeave)
      renderer.domElement.removeEventListener('pointerdown', onDown)
      bubbles.forEach(b => b.mesh.material.dispose())
      geo.dispose(); dropGeo.dispose(); dropMat.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    }
  }, [count, visible])

  return (
    <div ref={mountRef} className="fx-mount"
      style={{ background: 'radial-gradient(circle at 30% 30%, #1e3a5f 0, transparent 40%), radial-gradient(circle at 75% 70%, #3b1f5c 0, transparent 45%), #070b14' }} />
  )
}
