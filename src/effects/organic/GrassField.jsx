import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useVisibility } from '../../hooks/useVisibility'

const VERT = /* glsl */ `
attribute vec3 aOffset;
attribute vec4 aRand;          // x: rotation, y: height, z: lean, w: colour variation
uniform float uTime;
uniform vec3 uMouse;
uniform float uPress;
varying float vH;
varying float vRand;
varying float vFog;

void main() {
  vec3 p = position;
  float h = p.y;
  float height = 0.45 + aRand.y * 0.7;
  p.y *= height;
  float a = aRand.x * 6.2831;
  p.xz = mat2(cos(a), -sin(a), sin(a), cos(a)) * p.xz;
  vec3 world = p + aOffset;

  // layered wind gusts travelling across the field
  float gust = sin(aOffset.x * 0.45 - uTime * 1.3) * 0.5 + 0.5;
  float w = sin(aOffset.x * 1.7 + aOffset.z * 0.6 + uTime * 2.4) * 0.35 + gust * 0.9;
  float bend = h * h;
  world.xz += vec2(0.9, 0.35) * w * 0.32 * bend * height + aRand.z * 0.08 * bend;
  world.y -= gust * 0.08 * bend * height;

  // cursor flattens the blades around it
  vec2 d = aOffset.xz - uMouse.xz;
  float dist = length(d);
  float push = smoothstep(1.3, 0.0, dist) * uPress;
  world.xz += normalize(d + 1e-4) * push * 0.75 * bend * height;
  world.y -= push * 0.35 * bend * height;

  vH = h;
  vRand = aRand.w;
  vec4 mv = viewMatrix * vec4(world, 1.0);
  vFog = smoothstep(5.0, 18.0, -mv.z);
  gl_Position = projectionMatrix * mv;
}`

const FRAG = /* glsl */ `
uniform vec3 uBase;
uniform vec3 uTip;
uniform vec3 uFog;
varying float vH;
varying float vRand;
varying float vFog;
void main() {
  vec3 col = mix(uBase, uTip, smoothstep(0.0, 1.0, vH));
  col *= 0.75 + 0.5 * vRand;
  col *= 0.35 + 0.65 * smoothstep(0.0, 0.45, vH);        // ambient occlusion at the roots
  col += vec3(1.0, 0.85, 0.55) * pow(vH, 6.0) * 0.18;     // backlit tips
  gl_FragColor = vec4(mix(col, uFog, vFog), 1.0);
}`

// one tapered, slightly pre-curved blade
function bladeGeometry(segments = 4) {
  const pos = [], idx = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const w = 0.035 * (1 - t) + 0.002
    const z = t * t * 0.12
    pos.push(-w, t, z, w, t, z)
  }
  pos.push(0, 1.04, 0.14)
  for (let i = 0; i < segments; i++) {
    const a = i * 2
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }
  const tip = segments * 2 + 2
  idx.push(segments * 2, segments * 2 + 1, tip)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  return g
}

/**
 * A meadow of instanced grass blades swaying in travelling wind gusts.
 * The cursor walks through the field and flattens the blades around it.
 */
export default function GrassField({ count = 60000, base = '#0f2a12', tip = '#a3d65c', fog = '#2a2f45' }) {
  const mountRef = useRef(null)
  const visible = useVisibility(mountRef)

  useEffect(() => {
    const mount = mountRef.current
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    renderer.domElement.className = 'fx-canvas'
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60)
    const camBase = new THREE.Vector3(0, 1.35, 6.2)
    camera.position.copy(camBase)

    const blade = bladeGeometry()
    const geo = new THREE.InstancedBufferGeometry()
    geo.index = blade.index
    geo.setAttribute('position', blade.attributes.position)
    const offsets = new Float32Array(count * 3), rands = new Float32Array(count * 4)
    for (let i = 0; i < count; i++) {
      offsets[i * 3 + 2] = 5.2 - Math.pow(Math.random(), 0.7) * 21
      offsets[i * 3] = (Math.random() - 0.5) * (14 + (5.2 - offsets[i * 3 + 2]) * 0.9)  // wider further away
      rands.set([Math.random(), Math.random(), Math.random() - 0.5, Math.random()], i * 4)
    }
    geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 3))
    geo.setAttribute('aRand', new THREE.InstancedBufferAttribute(rands, 4))
    geo.instanceCount = count
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, -5), 20)

    const uniforms = {
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector3(0, 0, 99) },
      uPress: { value: 0 },
      uBase: { value: new THREE.Color(base) },
      uTip: { value: new THREE.Color(tip) },
      uFog: { value: new THREE.Color(fog) },
    }
    const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, side: THREE.DoubleSide })
    scene.add(new THREE.Mesh(geo, mat))

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(base).multiplyScalar(0.55) }))
    ground.rotation.x = -Math.PI / 2
    ground.position.z = -8
    scene.add(ground)

    const ndc = new THREE.Vector2()
    const ray = new THREE.Raycaster()
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const hit = new THREE.Vector3()
    const ptr = { inside: false, x: 0, y: 0 }
    const onMove = e => {
      const r = renderer.domElement.getBoundingClientRect()
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      ptr.inside = true
      ptr.x = ndc.x; ptr.y = ndc.y
    }
    const onLeave = () => { ptr.inside = false }
    renderer.domElement.addEventListener('pointermove', onMove)
    renderer.domElement.addEventListener('pointerleave', onLeave)

    const resize = () => {
      const { width, height } = mount.getBoundingClientRect()
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(mount)

    const t0 = performance.now()
    let raf
    const loop = () => {
      raf = requestAnimationFrame(loop)
      if (!visible.current) return
      uniforms.uTime.value = (performance.now() - t0) / 1000
      camera.position.x += (camBase.x + ptr.x * 0.5 - camera.position.x) * 0.03
      camera.position.y += (camBase.y + ptr.y * 0.15 - camera.position.y) * 0.03
      camera.lookAt(0, 0.45, 0)
      if (ptr.inside) {
        ray.setFromCamera(ndc, camera)
        if (ray.ray.intersectPlane(plane, hit)) uniforms.uMouse.value.lerp(hit, 0.2)
      }
      uniforms.uPress.value += ((ptr.inside ? 1 : 0) - uniforms.uPress.value) * 0.06
      renderer.render(scene, camera)
    }
    loop()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      renderer.domElement.removeEventListener('pointermove', onMove)
      renderer.domElement.removeEventListener('pointerleave', onLeave)
      blade.dispose()
      geo.dispose()
      mat.dispose()
      ground.geometry.dispose()
      ground.material.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    }
  }, [count, base, tip, fog, visible])

  return (
    <div ref={mountRef} className="fx-mount"
      style={{ background: 'radial-gradient(ellipse at 70% 12%, #f6d9a8 0, #c98a6b 6%, #4a3f63 26%, #1b1d33 60%)' }} />
  )
}
