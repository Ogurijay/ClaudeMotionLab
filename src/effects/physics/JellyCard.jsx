import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useVisibility } from '../../hooks/useVisibility'

const CW = 2.2, CH = 3.0          // card size (world units)
const NX = 9, NY = 12             // simulation particles
const MX = 44, MY = 60            // render mesh resolution (bilinear from particles)

function cardTexture(hue) {
  const w = 660, h = 900
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const g = c.getContext('2d')
  const grd = g.createLinearGradient(0, 0, w, h)
  grd.addColorStop(0, `hsl(${hue} 95% 72%)`)
  grd.addColorStop(1, `hsl(${hue + 40} 90% 58%)`)
  g.fillStyle = grd
  g.fillRect(0, 0, w, h)
  g.fillStyle = 'rgba(255,255,255,0.18)'
  for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(w * Math.random(), h * Math.random(), 30 + Math.random() * 90, 0, Math.PI * 2); g.fill() }
  g.fillStyle = 'rgba(255,255,255,0.95)'
  g.font = '900 150px Inter, "Arial Black", sans-serif'
  g.fillText('JELLY', 50, h - 120)
  g.font = '500 30px "JetBrains Mono", monospace'
  g.fillText('PH-01 · SOFT BODY', 56, h - 60)
  g.beginPath()
  g.arc(w - 120, 130, 60, 0, Math.PI * 2)
  g.lineWidth = 10
  g.strokeStyle = 'rgba(255,255,255,0.9)'
  g.stroke()
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/**
 * A soft-body jelly card simulated with 2D shape matching: drag any point and
 * the card stretches, wobbles and springs back home when released.
 */
export default function JellyCard({ stiffness = 0.07, damping = 0.9, hue = 330 }) {
  const mountRef = useRef(null)
  const visible = useVisibility(mountRef)

  useEffect(() => {
    const mount = mountRef.current
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.domElement.className = 'fx-canvas'
    renderer.domElement.style.cursor = 'grab'
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50)
    camera.position.set(0, 0, 9)
    scene.add(new THREE.AmbientLight(0xffffff, 1.4))
    const key = new THREE.DirectionalLight(0xffffff, 2.2)
    key.position.set(-2, 3, 5)
    scene.add(key)

    // particles: rest offsets from the centre, positions, velocities
    const n = NX * NY
    const rest = new Float32Array(n * 2), pos = new Float32Array(n * 2), vel = new Float32Array(n * 2)
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const k = j * NX + i
      rest[k * 2] = (i / (NX - 1) - 0.5) * CW
      rest[k * 2 + 1] = (0.5 - j / (NY - 1)) * CH
      pos[k * 2] = rest[k * 2]; pos[k * 2 + 1] = rest[k * 2 + 1]
    }

    const geo = new THREE.PlaneGeometry(CW, CH, MX - 1, MY - 1)
    const tex = cardTexture(hue)
    const mat = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.15, side: THREE.DoubleSide })
    const mesh = new THREE.Mesh(geo, mat)
    scene.add(mesh)

    let grabbed = -1
    const grabPos = new THREE.Vector2()
    const goal = new Float32Array(n * 2)
    // soft grab: every particle keeps its offset from the grab point, weighted by a gaussian falloff
    const grabOff = new Float32Array(n * 2), grabW = new Float32Array(n)

    const ray = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
    const hit = new THREE.Vector3()
    const toWorld = e => {
      const r = renderer.domElement.getBoundingClientRect()
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(ndc, camera)
      return ray.ray.intersectPlane(plane, hit) ? new THREE.Vector2(hit.x, hit.y) : null
    }
    const onDown = e => {
      const p = toWorld(e)
      if (!p) return
      let best = -1, bd = 0.6 * 0.6
      for (let k = 0; k < n; k++) {
        const dx = pos[k * 2] - p.x, dy = pos[k * 2 + 1] - p.y, d = dx * dx + dy * dy
        if (d < bd) { bd = d; best = k }
      }
      if (best < 0) return
      grabbed = best
      grabPos.copy(p)
      for (let k = 0; k < n; k++) {
        const dx = pos[k * 2] - p.x, dy = pos[k * 2 + 1] - p.y
        grabOff[k * 2] = dx; grabOff[k * 2 + 1] = dy
        grabW[k] = Math.exp(-(dx * dx + dy * dy) / 0.45)
      }
      renderer.domElement.setPointerCapture(e.pointerId)
      renderer.domElement.style.cursor = 'grabbing'
    }
    const onMove = e => { if (grabbed >= 0) { const p = toWorld(e); if (p) grabPos.copy(p) } }
    const onUp = () => { grabbed = -1; renderer.domElement.style.cursor = 'grab' }
    renderer.domElement.addEventListener('pointerdown', onDown)
    renderer.domElement.addEventListener('pointermove', onMove)
    renderer.domElement.addEventListener('pointerup', onUp)
    renderer.domElement.addEventListener('pointercancel', onUp)

    const step = (t) => {
      // shape matching: best rigid fit (centre of mass + rotation) of the rest shape
      let cx = 0, cy = 0
      for (let k = 0; k < n; k++) { cx += pos[k * 2]; cy += pos[k * 2 + 1] }
      cx /= n; cy /= n
      let a00 = 0, a01 = 0, a10 = 0, a11 = 0
      for (let k = 0; k < n; k++) {
        const px = pos[k * 2] - cx, py = pos[k * 2 + 1] - cy, rx = rest[k * 2], ry = rest[k * 2 + 1]
        a00 += px * rx; a01 += px * ry; a10 += py * rx; a11 += py * ry
      }
      let ang = Math.atan2(a10 - a01, a00 + a11)
      // when nobody holds it, the card is pulled home: centre to origin, upright
      if (grabbed < 0) {
        cx *= 0.96; cy *= 0.96; ang *= 0.94
      }
      const c = Math.cos(ang), s = Math.sin(ang)
      for (let k = 0; k < n; k++) {
        const rx = rest[k * 2], ry = rest[k * 2 + 1]
        goal[k * 2] = cx + c * rx - s * ry
        goal[k * 2 + 1] = cy + s * rx + c * ry
      }
      for (let k = 0; k < n; k++) {
        vel[k * 2] = (vel[k * 2] + (goal[k * 2] - pos[k * 2]) * stiffness) * damping
        vel[k * 2 + 1] = (vel[k * 2 + 1] + (goal[k * 2 + 1] - pos[k * 2 + 1]) * stiffness) * damping
        if (grabbed >= 0 && grabW[k] > 0.02) {
          const w = grabW[k] * 0.35
          vel[k * 2] += (grabPos.x + grabOff[k * 2] - pos[k * 2]) * w
          vel[k * 2 + 1] += (grabPos.y + grabOff[k * 2 + 1] - pos[k * 2 + 1]) * w
        }
        pos[k * 2] += vel[k * 2]
        pos[k * 2 + 1] += vel[k * 2 + 1]
      }
      // idle breathing wobble
      if (grabbed < 0) {
        const k = ((t * 0.5) | 0) % n
        vel[k * 2 + 1] += Math.sin(t * 3) * 0.0008
      }
    }

    const P = geo.attributes.position
    const writeMesh = () => {
      for (let j = 0; j < MY; j++) for (let i = 0; i < MX; i++) {
        // bilinear interpolation of the particle grid
        const fx = (i / (MX - 1)) * (NX - 1), fy = (j / (MY - 1)) * (NY - 1)
        const i0 = Math.min(NX - 2, fx | 0), j0 = Math.min(NY - 2, fy | 0)
        const tx = fx - i0, ty = fy - j0
        const k00 = j0 * NX + i0, k10 = k00 + 1, k01 = k00 + NX, k11 = k01 + 1
        let x = 0, y = 0, z = 0
        const w = [(1 - tx) * (1 - ty), tx * (1 - ty), (1 - tx) * ty, tx * ty]
        ;[k00, k10, k01, k11].forEach((k, q) => {
          x += pos[k * 2] * w[q]; y += pos[k * 2 + 1] * w[q]
          // bulge toward the viewer where the jelly is stretched from its goal
          z += Math.hypot(pos[k * 2] - goal[k * 2], pos[k * 2 + 1] - goal[k * 2 + 1]) * w[q]
        })
        P.setXYZ(j * MX + i, x, y, z * 0.9)
      }
      P.needsUpdate = true
      geo.computeVertexNormals()
    }

    const resize = () => {
      const { width, height } = mount.getBoundingClientRect()
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.position.z = width / height < 0.9 ? 13 : 9
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
      const t = (performance.now() - t0) / 1000
      step(t)
      step(t)
      writeMesh()
      renderer.render(scene, camera)
    }
    loop()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      renderer.domElement.removeEventListener('pointerdown', onDown)
      renderer.domElement.removeEventListener('pointermove', onMove)
      renderer.domElement.removeEventListener('pointerup', onUp)
      renderer.domElement.removeEventListener('pointercancel', onUp)
      geo.dispose(); mat.dispose(); tex.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    }
  }, [stiffness, damping, hue, visible])

  return <div ref={mountRef} className="fx-mount" style={{ background: 'radial-gradient(ellipse at 50% 40%, #3a1830, #120a10 70%)' }} />
}
