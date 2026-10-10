import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

const WORDS = ['Aurora', 'Prism', 'Velvet', 'Nebula', 'Quartz', 'Ember', 'Lumen', 'Halo', 'Drift', 'Vapor', 'Orbit', 'Flux',
  'Ion', 'Echo', 'Nova', 'Sable', 'Tide', 'Zenith', 'Mirage', 'Pulse', 'Glyph', 'Opal', 'Strata', 'Kinetic']

// procedural card art — no image assets needed
function makeCardTexture(i, word) {
  const w = 512, h = 672
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const g = c.getContext('2d')
  const hue = (i * 37 + 200) % 360
  const bg = g.createLinearGradient(0, 0, w, h)
  bg.addColorStop(0, `hsl(${hue} 85% 58%)`)
  bg.addColorStop(1, `hsl(${(hue + 80) % 360} 80% 22%)`)
  g.fillStyle = bg
  g.fillRect(0, 0, w, h)
  for (let k = 0; k < 3; k++) {
    const rg = g.createRadialGradient(Math.random() * w, Math.random() * h, 0, Math.random() * w, Math.random() * h, 320)
    rg.addColorStop(0, `hsla(${(hue + 140 + k * 40) % 360} 100% 70% / 0.55)`)
    rg.addColorStop(1, 'transparent')
    g.fillStyle = rg
    g.fillRect(0, 0, w, h)
  }
  g.strokeStyle = 'rgba(255,255,255,0.12)'
  for (let x = 0; x < w; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke() }
  for (let y = 0; y < h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke() }
  g.fillStyle = 'rgba(255,255,255,0.95)'
  g.font = '800 92px Inter, Arial, sans-serif'
  g.fillText(word, 36, h - 64)
  g.font = '500 22px "JetBrains Mono", monospace'
  g.fillStyle = 'rgba(255,255,255,0.75)'
  g.fillText(`№ ${String(i + 1).padStart(2, '0')} — MOTION LAB`, 38, 58)
  g.beginPath()
  g.arc(w - 80, 80, 26, 0, Math.PI * 2)
  g.strokeStyle = 'rgba(255,255,255,0.8)'
  g.lineWidth = 3
  g.stroke()
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

const VERT = /* glsl */ `
uniform float uVel;
varying vec2 vUv;
varying float vDepth;
void main() {
  vUv = uv;
  vec3 p = position;
  p.z += sin(uv.x * 3.14159) * uVel * 0.45;   // cards bend with scroll speed
  p.y += sin(uv.x * 3.14159) * uVel * 0.12;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`

const FRAG = /* glsl */ `
uniform sampler2D uTex;
uniform float uVel;
uniform vec3 uBg;
varying vec2 vUv;
varying float vDepth;
float roundedBox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
void main() {
  float shift = uVel * 0.03;
  vec3 col = vec3(texture2D(uTex, vUv + vec2(shift, 0.0)).r,
                  texture2D(uTex, vUv).g,
                  texture2D(uTex, vUv - vec2(shift, 0.0)).b);
  float d = roundedBox(vUv - 0.5, vec2(0.5), 0.06);
  float mask = 1.0 - smoothstep(-0.004, 0.0, d);
  float fog = smoothstep(3.0, 15.0, vDepth);
  float nearFade = smoothstep(0.3, 1.6, vDepth);
  col = mix(col, uBg, fog);
  gl_FragColor = vec4(col, mask * nearFade);
  #include <colorspace_fragment>
}`

/**
 * Scroll-driven 3D gallery: cards line the walls of a spiral tunnel and the
 * camera flies through as you scroll. Cards bend and split RGB with velocity.
 */
export default function SpiralGallery({ count = 24, spacing = 1.7, radius = 2.7 }) {
  const trackRef = useRef(null)
  const mountRef = useRef(null)
  const [active, setActive] = useState(0)

  useEffect(() => {
    const track = trackRef.current
    const mount = mountRef.current
    let disposed = false
    let cleanup = () => {}

    document.fonts.load('800 92px Inter').finally(() => {
      if (disposed) return
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.domElement.className = 'fx-canvas'
      mount.appendChild(renderer.domElement)

      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 60)
      const bg = new THREE.Color('#07070b')
      const geo = new THREE.PlaneGeometry(1.6, 2.1, 24, 1)
      const mats = []
      const textures = []

      for (let i = 0; i < count; i++) {
        const tex = makeCardTexture(i, WORDS[i % WORDS.length])
        textures.push(tex)
        const mat = new THREE.ShaderMaterial({
          vertexShader: VERT, fragmentShader: FRAG, transparent: true, side: THREE.DoubleSide,
          uniforms: { uTex: { value: tex }, uVel: { value: 0 }, uBg: { value: bg } },
        })
        mats.push(mat)
        const mesh = new THREE.Mesh(geo, mat)
        const a = i * 0.72
        const z = -i * spacing
        mesh.position.set(Math.cos(a) * radius, Math.sin(a) * radius, z)
        mesh.lookAt(0, 0, z + 3.2)   // face the axis, angled toward the oncoming camera
        scene.add(mesh)
      }

      const pathLen = (count - 1) * spacing
      let progress = 0, smooth = 0, vel = 0, lastSmooth = 0
      const pointer = { x: 0, y: 0, sx: 0, sy: 0 }
      const onMove = e => {
        pointer.x = (e.clientX / window.innerWidth) * 2 - 1
        pointer.y = (e.clientY / window.innerHeight) * 2 - 1
      }
      window.addEventListener('pointermove', onMove)

      const readScroll = () => {
        const r = track.getBoundingClientRect()
        const total = r.height - window.innerHeight
        progress = Math.min(1, Math.max(0, -r.top / total))
      }
      const resize = () => {
        const { width, height } = mount.getBoundingClientRect()
        renderer.setSize(width, height, false)
        camera.aspect = width / height
        camera.updateProjectionMatrix()
      }
      resize()
      readScroll()
      const ro = new ResizeObserver(resize)
      ro.observe(mount)
      window.addEventListener('scroll', readScroll, { passive: true })

      let raf, lastActive = -1
      const loop = () => {
        raf = requestAnimationFrame(loop)
        const r = track.getBoundingClientRect()
        if (r.bottom < -100 || r.top > window.innerHeight + 100) return
        smooth += (progress - smooth) * 0.07
        const dv = (smooth - lastSmooth) * 60
        lastSmooth = smooth
        vel += (dv - vel) * 0.15
        pointer.sx += (pointer.x - pointer.sx) * 0.05
        pointer.sy += (pointer.y - pointer.sy) * 0.05

        camera.position.set(pointer.sx * 0.5, -pointer.sy * 0.4, 3 - smooth * (pathLen + 1))
        camera.rotation.set(-pointer.sy * 0.06, -pointer.sx * 0.08, smooth * Math.PI * 1.6)
        const v = Math.max(-1.2, Math.min(1.2, vel * 5))
        for (const m of mats) m.uniforms.uVel.value = v

        // the next card ahead of the camera
        const idx = Math.min(count - 1, Math.max(0, Math.ceil((1.2 - camera.position.z) / spacing)))
        if (idx !== lastActive) { lastActive = idx; setActive(idx) }
        renderer.render(scene, camera)
      }
      loop()

      cleanup = () => {
        cancelAnimationFrame(raf)
        ro.disconnect()
        window.removeEventListener('scroll', readScroll)
        window.removeEventListener('pointermove', onMove)
        geo.dispose()
        mats.forEach(m => m.dispose())
        textures.forEach(t => t.dispose())
        renderer.dispose()
        renderer.forceContextLoss()
        renderer.domElement.remove()
      }
    })
    return () => { disposed = true; cleanup() }
  }, [count, spacing, radius])

  return (
    <div className="spiral" ref={trackRef} style={{ height: `${Math.max(300, count * 22)}vh` }}>
      <div className="spiral__sticky">
        <div className="fx-mount" ref={mountRef} />
        <div className="spiral__hud">
          <span>{String(active + 1).padStart(2, '0')}</span>
          <span className="spiral__word">{WORDS[active % WORDS.length]}</span>
          <span>/ {String(count).padStart(2, '0')}</span>
        </div>
      </div>
    </div>
  )
}
