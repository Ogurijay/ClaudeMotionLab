import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useVisibility } from '../../hooks/useVisibility'

const NX = 34, NY = 24              // particles across / down
const W = 3.6, H = 2.5              // banner size (world units)

function bannerTexture() {
  const w = 1024, h = 712
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const g = c.getContext('2d')
  g.fillStyle = '#fb7185'
  g.fillRect(0, 0, w, h)
  // hazard-stripe hem
  g.fillStyle = '#111827'
  g.fillRect(0, h - 90, w, 90)
  g.fillStyle = '#fb7185'
  for (let x = -90; x < w; x += 90) {
    g.beginPath(); g.moveTo(x, h); g.lineTo(x + 45, h); g.lineTo(x + 135, h - 90); g.lineTo(x + 90, h - 90); g.fill()
  }
  g.fillStyle = '#fff1f2'
  g.font = '900 200px Inter, "Arial Black", sans-serif'
  g.textAlign = 'center'
  g.fillText('CLOTH', w / 2, h * 0.5)
  g.font = '600 38px "JetBrains Mono", monospace'
  g.fillText('PH-02 · VERLET · WIND', w / 2, h * 0.5 + 80)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

/**
 * A banner of Verlet cloth hanging from a rod: gravity, gusty aerodynamic wind
 * that pushes along the cloth normals, and distance constraints. Grab and pull
 * the fabric; hovering blows on it.
 */
export default function ClothBanner({ wind = 1, iterations = 5 }) {
  const mountRef = useRef(null)
  const visible = useVisibility(mountRef)

  useEffect(() => {
    const mount = mountRef.current
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.domElement.className = 'fx-canvas'
    renderer.domElement.style.cursor = 'grab'
    renderer.domElement.style.touchAction = 'none'   // dragging must not scroll the page
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50)
    camera.position.set(0.6, -0.2, 7)
    camera.lookAt(0, -0.3, 0)
    scene.add(new THREE.AmbientLight(0xffffff, 1.1))
    const sun = new THREE.DirectionalLight(0xffffff, 2.4)
    sun.position.set(3, 4, 5)
    scene.add(sun)
    const fill = new THREE.DirectionalLight(0xffc0cb, 0.8)
    fill.position.set(-4, -1, -3)
    scene.add(fill)

    const n = NX * NY
    const pos = new Float32Array(n * 3), prev = new Float32Array(n * 3), pinned = new Uint8Array(n)
    const top = H / 2 + 0.2
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const k = j * NX + i
      pos[k * 3] = prev[k * 3] = (i / (NX - 1) - 0.5) * W
      pos[k * 3 + 1] = prev[k * 3 + 1] = top - (j / (NY - 1)) * H
      pos[k * 3 + 2] = prev[k * 3 + 2] = 0
      if (j === 0) pinned[k] = 1
    }
    // structural + shear + bending constraints
    const cons = []
    const add = (a, b) => {
      const dx = pos[a * 3] - pos[b * 3], dy = pos[a * 3 + 1] - pos[b * 3 + 1]
      cons.push(a, b, Math.hypot(dx, dy))
    }
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const k = j * NX + i
      if (i < NX - 1) add(k, k + 1)
      if (j < NY - 1) add(k, k + NX)
      if (i < NX - 1 && j < NY - 1) { add(k, k + NX + 1); add(k + 1, k + NX) }
      if (i < NX - 2) add(k, k + 2)
      if (j < NY - 2) add(k, k + NX * 2)
    }
    const C = new Float32Array(cons)

    const geo = new THREE.PlaneGeometry(W, H, NX - 1, NY - 1)
    const tex = bannerTexture()
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, side: THREE.DoubleSide })
    const cloth = new THREE.Mesh(geo, mat)
    scene.add(cloth)
    const rodGeo = new THREE.CylinderGeometry(0.05, 0.05, W + 0.6, 16)
    const rodMat = new THREE.MeshStandardMaterial({ color: 0x2b2b33, metalness: 0.8, roughness: 0.3 })
    const rod = new THREE.Mesh(rodGeo, rodMat)
    rod.rotation.z = Math.PI / 2
    rod.position.y = top + 0.02
    scene.add(rod)

    // pointer: grab nearest particle, or blow on the cloth while hovering
    const ray = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
    const hit = new THREE.Vector3()
    let grabbed = -1, hover = false
    const grabPt = new THREE.Vector3()
    const toPlane = e => {
      const r = renderer.domElement.getBoundingClientRect()
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(ndc, camera)
      return ray.ray.intersectPlane(plane, hit) ? hit.clone() : null
    }
    const onDown = e => {
      const p = toPlane(e)
      if (!p) return
      let best = -1, bd = 0.5 * 0.5
      for (let k = 0; k < n; k++) {
        if (pinned[k]) continue
        const dx = pos[k * 3] - p.x, dy = pos[k * 3 + 1] - p.y, d = dx * dx + dy * dy
        if (d < bd) { bd = d; best = k }
      }
      if (best < 0) return
      grabbed = best
      plane.constant = -pos[best * 3 + 2]
      grabPt.copy(p)
      renderer.domElement.setPointerCapture(e.pointerId)
      renderer.domElement.style.cursor = 'grabbing'
    }
    const onMove = e => {
      hover = true
      const p = toPlane(e)
      if (p) grabPt.copy(p)
    }
    const onUp = () => { grabbed = -1; plane.constant = 0; renderer.domElement.style.cursor = 'grab' }
    const onLeave = () => { hover = false }
    renderer.domElement.addEventListener('pointerdown', onDown)
    renderer.domElement.addEventListener('pointermove', onMove)
    renderer.domElement.addEventListener('pointerup', onUp)
    renderer.domElement.addEventListener('pointercancel', onUp)
    renderer.domElement.addEventListener('pointerleave', onLeave)

    const N = geo.attributes.normal
    const step = t => {
      const dt2 = (1 / 60) * (1 / 60)
      const gust = (Math.sin(t * 0.9) * 0.5 + 0.5) * (0.6 + 0.4 * Math.sin(t * 2.7 + 1.3))
      const wx = 3 * wind * gust, wz = (2.5 + 7 * gust) * wind
      for (let k = 0; k < n; k++) {
        if (pinned[k]) continue
        const i3 = k * 3
        // aerodynamic wind: only the component along the surface normal pushes the cloth
        const nx = N.getX(k), ny = N.getY(k), nz = N.getZ(k)
        const flow = (nx * wx + nz * wz) * (0.6 + 0.4 * Math.sin(t * 4 + pos[i3] * 2 + pos[i3 + 1]))
        let fx = nx * flow, fy = -9.8 + ny * flow, fz = nz * flow
        if (hover && grabbed < 0) {
          const dx = pos[i3] - grabPt.x, dy = pos[i3 + 1] - grabPt.y
          const f = Math.max(0, 1 - Math.hypot(dx, dy) / 0.7)
          fz -= f * 60
        }
        const x = pos[i3], y = pos[i3 + 1], z = pos[i3 + 2]
        pos[i3] += (x - prev[i3]) * 0.99 + fx * dt2
        pos[i3 + 1] += (y - prev[i3 + 1]) * 0.99 + fy * dt2
        pos[i3 + 2] += (z - prev[i3 + 2]) * 0.99 + fz * dt2
        prev[i3] = x; prev[i3 + 1] = y; prev[i3 + 2] = z
      }
      for (let it = 0; it < iterations; it++) {
        for (let c = 0; c < C.length; c += 3) {
          const a = C[c] * 3, b = C[c + 1] * 3, rest = C[c + 2]
          const dx = pos[b] - pos[a], dy = pos[b + 1] - pos[a + 1], dz = pos[b + 2] - pos[a + 2]
          const d = Math.hypot(dx, dy, dz) || 1e-6
          const diff = (d - rest) / d
          const wa = pinned[C[c]] ? 0 : pinned[C[c + 1]] ? 1 : 0.5
          const wb = pinned[C[c + 1]] ? 0 : 1 - wa
          pos[a] += dx * diff * wa; pos[a + 1] += dy * diff * wa; pos[a + 2] += dz * diff * wa
          pos[b] -= dx * diff * wb; pos[b + 1] -= dy * diff * wb; pos[b + 2] -= dz * diff * wb
        }
        if (grabbed >= 0) {
          const g = grabbed * 3
          pos[g] = grabPt.x; pos[g + 1] = grabPt.y; pos[g + 2] = grabPt.z
        }
      }
    }

    const P = geo.attributes.position
    const resize = () => {
      const { width, height } = mount.getBoundingClientRect()
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.position.z = width / height < 0.9 ? 11 : 7
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
      P.array.set(pos)
      P.needsUpdate = true
      geo.computeVertexNormals()
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
      renderer.domElement.removeEventListener('pointerleave', onLeave)
      geo.dispose(); mat.dispose(); tex.dispose(); rodGeo.dispose(); rodMat.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    }
  }, [wind, iterations, visible])

  return <div ref={mountRef} className="fx-mount" style={{ background: 'linear-gradient(#1b1320, #0e0a10)' }} />
}
