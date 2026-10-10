import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useVisibility } from '../../hooks/useVisibility'
import { adaptiveRenderer } from '../../lib/perf'

const PW = 2.4, PH = 3.2      // page size in world units, centred on the origin
const R = 0.2                 // curl cylinder radius

const PAGES = [
  { no: '01', title: 'Paper', accent: '#e11d48', shape: 'circle' },
  { no: '02', title: 'Fold', accent: '#2563eb', shape: 'square' },
  { no: '03', title: 'Ink', accent: '#111827', shape: 'stroke' },
  { no: '04', title: 'Craft', accent: '#d97706', shape: 'triangle' },
]

// procedural magazine page
function pageTexture(page, back = false) {
  const w = 900, h = 1200
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const g = c.getContext('2d')
  g.fillStyle = back ? '#efe9dc' : '#f5f0e5'
  g.fillRect(0, 0, w, h)
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(80,60,30,${Math.random() * 0.05})`
    g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1)
  }
  if (back) {
    // faint show-through of the front, mirrored
    g.save(); g.globalAlpha = 0.07; g.translate(w, 0); g.scale(-1, 1)
    drawContent(g, page, w, h)
    g.restore()
  } else drawContent(g, page, w, h)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

function drawContent(g, page, w, h) {
  g.fillStyle = '#1f1b16'
  g.font = '500 28px "JetBrains Mono", monospace'
  g.fillText(`№ ${page.no} — CLAUDE MOTION LAB`, 70, 100)
  g.fillRect(70, 124, w - 140, 2)
  g.font = 'italic 700 170px Georgia, serif'
  g.fillText(page.title, 64, 330)
  g.fillStyle = page.accent
  const cx = w - 220, cy = 560
  g.beginPath()
  if (page.shape === 'circle') g.arc(cx, cy, 130, 0, Math.PI * 2)
  else if (page.shape === 'square') g.rect(cx - 120, cy - 120, 240, 240)
  else if (page.shape === 'triangle') { g.moveTo(cx, cy - 140); g.lineTo(cx + 140, cy + 110); g.lineTo(cx - 140, cy + 110) }
  else { g.lineWidth = 46; g.lineCap = 'round'; g.moveTo(cx - 130, cy + 90); g.quadraticCurveTo(cx, cy - 200, cx + 120, cy + 60); g.strokeStyle = page.accent; g.stroke() }
  g.fill()
  g.fillStyle = 'rgba(31,27,22,0.75)'
  for (let i = 0; i < 9; i++) g.fillRect(70, 430 + i * 34, 380 - (i % 3) * 40, 12)
  for (let col = 0; col < 2; col++) {
    for (let i = 0; i < 14; i++) {
      g.fillStyle = 'rgba(31,27,22,0.55)'
      g.fillRect(70 + col * 400, 760 + i * 28, 360 - ((i * 37) % 90), 9)
    }
  }
  g.font = '500 24px "JetBrains Mono", monospace'
  g.fillStyle = '#1f1b16'
  g.fillText(page.no, w - 110, h - 60)
}

const CURL_VERT = /* glsl */ `
uniform vec2 uOrigin;
uniform vec2 uDir;
uniform float uRadius;
varying vec2 vUv;
varying float vShade;
void main() {
  vec3 p = position;
  float s = dot(p.xy - uOrigin, uDir);
  vShade = 1.0;
  if (s > 0.0) {
    vec2 base = p.xy - uDir * s;
    float th = s / uRadius;
    if (th < 3.14159265) {
      p.xy = base + uDir * (uRadius * sin(th));
      p.z = uRadius * (1.0 - cos(th));
      vShade = cos(th);
    } else {
      p.xy = base - uDir * (s - 3.14159265 * uRadius);
      p.z = 2.0 * uRadius;
      vShade = -1.0;
    }
  }
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`

const CURL_FRAG = /* glsl */ `
uniform sampler2D uFront;
uniform sampler2D uBack;
varying vec2 vUv;
varying float vShade;
void main() {
  vec4 c = gl_FrontFacing ? texture2D(uFront, vUv) : texture2D(uBack, vec2(1.0 - vUv.x, vUv.y));
  // light falls off around the curl; the back face catches a soft highlight at the crest
  float light = gl_FrontFacing ? 0.72 + 0.28 * max(vShade, 0.0) : 0.8 + 0.2 * (1.0 - abs(vShade));
  gl_FragColor = vec4(c.rgb * light, 1.0);
  #include <colorspace_fragment>
}`

const UNDER_FRAG = /* glsl */ `
uniform sampler2D uFront;
uniform vec2 uOrigin;
uniform vec2 uDir;
uniform float uActive;
varying vec2 vUv;
varying vec3 vPos;
void main() {
  vec3 c = texture2D(uFront, vUv).rgb;
  float s = dot(vPos.xy - uOrigin, uDir);
  float shadow = s > 0.0 ? (1.0 - smoothstep(0.0, 0.55, s)) * 0.45 * uActive : 0.0;
  gl_FragColor = vec4(c * (1.0 - shadow), 1.0);
  #include <colorspace_fragment>
}`

const UNDER_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vPos;
void main() { vUv = uv; vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`

/**
 * A magazine whose pages curl around a cylinder as you drag a corner — the
 * corner tracks the cursor exactly. Release past the spine to turn the page.
 */
export default function PageCurl({ pages = PAGES }) {
  const mountRef = useRef(null)
  const visible = useVisibility(mountRef)

  useEffect(() => {
    const mount = mountRef.current
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    const perf = adaptiveRenderer(renderer, 1.5, () => resize())
    renderer.domElement.className = 'fx-canvas'
    renderer.domElement.style.cursor = 'grab'
    renderer.domElement.style.touchAction = 'none'   // dragging must not scroll the page
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50)
    camera.position.set(0, 0, 8.4)
    const group = new THREE.Group()
    group.rotation.set(-0.12, 0.08, 0)
    scene.add(group)

    const fronts = pages.map(p => pageTexture(p))
    const backs = pages.map(p => pageTexture(p, true))
    let index = 0

    const curlU = {
      uOrigin: { value: new THREE.Vector2(9, 9) }, uDir: { value: new THREE.Vector2(1, 0) }, uRadius: { value: R },
      uFront: { value: fronts[0] }, uBack: { value: backs[0] },
    }
    const curlGeo = new THREE.PlaneGeometry(PW, PH, 80, 100)
    const curl = new THREE.Mesh(curlGeo, new THREE.ShaderMaterial({ vertexShader: CURL_VERT, fragmentShader: CURL_FRAG, uniforms: curlU, side: THREE.DoubleSide }))
    curl.position.z = 0.002
    group.add(curl)

    const underU = { uFront: { value: fronts[1 % pages.length] }, uOrigin: curlU.uOrigin, uDir: curlU.uDir, uActive: { value: 0 } }
    const underGeo = new THREE.PlaneGeometry(PW, PH)
    const under = new THREE.Mesh(underGeo, new THREE.ShaderMaterial({ vertexShader: UNDER_VERT, fragmentShader: UNDER_FRAG, uniforms: underU }))
    group.add(under)

    // soft drop shadow under the magazine
    const shadowCanvas = document.createElement('canvas')
    shadowCanvas.width = 300; shadowCanvas.height = 380
    const sg = shadowCanvas.getContext('2d')
    sg.filter = 'blur(22px)'
    sg.fillStyle = 'rgba(0,0,0,0.75)'
    sg.fillRect(50, 50, 200, 280)
    const shadowTex = new THREE.CanvasTexture(shadowCanvas)
    const shadowGeo = new THREE.PlaneGeometry(PW * 1.5, PH * 1.36)
    const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })
    const shadow = new THREE.Mesh(shadowGeo, shadowMat)
    shadow.position.set(0.14, -0.18, -0.05)
    group.add(shadow)

    // drag state, in page-local coordinates
    const corner = new THREE.Vector2(PW / 2, -PH / 2)
    const handle = new THREE.Vector2().copy(corner)      // where the corner currently sits
    const target = new THREE.Vector2().copy(corner)
    let dragging = false, turning = false

    const setFold = () => {
      const d = corner.clone().sub(handle)
      const len = d.length()
      if (len < 1e-3) { curlU.uOrigin.value.set(99, 99); underU.uActive.value = 0; return }
      d.divideScalar(len)
      const mid = corner.clone().add(handle).multiplyScalar(0.5)
      // shift the fold so a point at the corner lands exactly on the handle after wrapping the cylinder
      curlU.uOrigin.value.copy(mid.sub(d.clone().multiplyScalar((Math.PI * R) / 2)))
      curlU.uDir.value.copy(d)
      underU.uActive.value = Math.min(1, len * 2)
    }

    const ray = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    const plane = new THREE.Plane()
    const hit = new THREE.Vector3()
    const toLocal = e => {
      const r = renderer.domElement.getBoundingClientRect()
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(ndc, camera)
      plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 0, 1).applyQuaternion(group.quaternion), group.position)
      if (!ray.ray.intersectPlane(plane, hit)) return null
      const local = group.worldToLocal(hit.clone())
      return new THREE.Vector2(local.x, local.y)
    }
    const onDown = e => {
      if (turning) return
      const p = toLocal(e)
      if (!p || Math.abs(p.x) > PW / 2 || Math.abs(p.y) > PH / 2 || p.x < 0) return
      corner.set(PW / 2, p.y > 0 ? PH / 2 : -PH / 2)
      handle.copy(corner)
      dragging = true
      renderer.domElement.setPointerCapture(e.pointerId)
      renderer.domElement.style.cursor = 'grabbing'
      target.copy(p)
    }
    const onMove = e => {
      if (!dragging) return
      const p = toLocal(e)
      if (p) target.copy(p)
    }
    const onUp = () => {
      if (!dragging) return
      dragging = false
      renderer.domElement.style.cursor = 'grab'
    renderer.domElement.style.touchAction = 'none'   // dragging must not scroll the page
      if (target.x < 0) { turning = true; target.set(-PW / 2 - PW * 0.55, corner.y * 0.6) }   // finish the turn
      else target.copy(corner)
    }
    renderer.domElement.addEventListener('pointerdown', onDown)
    renderer.domElement.addEventListener('pointermove', onMove)
    renderer.domElement.addEventListener('pointerup', onUp)
    renderer.domElement.addEventListener('pointercancel', onUp)

    const resize = () => {
      const { width, height } = mount.getBoundingClientRect()
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.position.z = width / height < 0.9 ? 12 : 8.4
      camera.updateProjectionMatrix()
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
      if (!dragging && !turning && target.equals(corner)) {
        // idle: the bottom corner lifts a little, inviting a drag
        const lift = 0.16 + Math.sin(t * 2) * 0.06
        handle.lerp(new THREE.Vector2(corner.x - lift, corner.y + lift * 0.7), 0.08)
      } else handle.lerp(target, dragging ? 0.35 : 0.12)

      if (turning && handle.distanceTo(target) < 0.03) {
        index = (index + 1) % pages.length
        curlU.uFront.value = fronts[index]
        curlU.uBack.value = backs[index]
        underU.uFront.value = fronts[(index + 1) % pages.length]
        corner.set(PW / 2, -PH / 2)
        handle.copy(corner)
        target.copy(corner)
        turning = false
      }
      setFold()
      group.rotation.y = 0.08 + Math.sin(t * 0.4) * 0.03
      renderer.render(scene, camera)
    }
    loop()

    return () => {
      cancelAnimationFrame(raf)
      perf.dispose()
      ro.disconnect()
      renderer.domElement.removeEventListener('pointerdown', onDown)
      renderer.domElement.removeEventListener('pointermove', onMove)
      renderer.domElement.removeEventListener('pointerup', onUp)
      renderer.domElement.removeEventListener('pointercancel', onUp)
      ;[...fronts, ...backs].forEach(t => t.dispose())
      ;[curlGeo, underGeo, shadowGeo].forEach(g => g.dispose())
      curl.material.dispose(); under.material.dispose(); shadowMat.dispose(); shadowTex.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    }
  }, [pages, visible])

  return <div ref={mountRef} className="fx-mount" style={{ background: 'radial-gradient(ellipse at 50% 30%, #2b2620, #121010 70%)' }} />
}
