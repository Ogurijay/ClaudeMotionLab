import { useEffect, useRef } from 'react'
import { useVisibility } from '../../hooks/useVisibility'

// heat ramp for particle age: white → yellow → orange → red → ember
const RAMP = [[255, 255, 255], [255, 236, 120], [255, 160, 40], [235, 60, 40], [90, 20, 40]]
const ramp = k => {
  const f = Math.min(0.999, Math.max(0, k)) * (RAMP.length - 1)
  const i = Math.floor(f), t = f - i, a = RAMP[i], b = RAMP[i + 1]
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

/**
 * The cursor drags a trail of 8-bit sparks on a low-resolution pixel grid,
 * with persistence like an old screen. Click for a pixel explosion and shock
 * ring. With no cursor, a comet wanders on its own.
 */
export default function PixelTrail({ pixel = 5, sparks = 6 }) {
  const canvasRef = useRef(null)
  const visible = useVisibility(canvasRef)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let W = 0, H = 0, img, buf
    const parts = [], rings = []
    const ptr = { x: 0, y: 0, px: 0, py: 0, inside: false }

    const resize = () => {
      const r = canvas.getBoundingClientRect()
      W = Math.max(40, Math.round(r.width / pixel)); H = Math.max(30, Math.round(r.height / pixel))
      canvas.width = W; canvas.height = H
      img = ctx.createImageData(W, H)
      buf = new Float32Array(W * H * 3)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const toCell = e => { const r = canvas.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H] }
    const onMove = e => { [ptr.x, ptr.y] = toCell(e); if (!ptr.inside) { ptr.px = ptr.x; ptr.py = ptr.y } ptr.inside = true }
    const onLeave = () => { ptr.inside = false }
    const burst = (x, y) => {
      for (let i = 0; i < 160; i++) {
        const a = Math.random() * Math.PI * 2, s = 0.4 + Math.random() * 2.2
        parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: 40 + Math.random() * 50 })
      }
      rings.push({ x, y, r: 1, life: 0 })
    }
    const onDown = e => { const [x, y] = toCell(e); burst(x, y) }
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerleave', onLeave)
    canvas.addEventListener('pointerdown', onDown)

    const plot = (x, y, c, a = 1) => {
      x |= 0; y |= 0
      if (x < 0 || y < 0 || x >= W || y >= H) return
      const i = (y * W + x) * 3
      buf[i] = Math.min(255, buf[i] + c[0] * a); buf[i + 1] = Math.min(255, buf[i + 1] + c[1] * a); buf[i + 2] = Math.min(255, buf[i + 2] + c[2] * a)
    }

    let raf, frame = 0
    const loop = now => {
      raf = requestAnimationFrame(loop)
      if (!visible.current) return
      frame++
      const t = now / 1000
      if (!ptr.inside) {
        // wandering comet so the effect is alive without a cursor
        ptr.x = W * (0.5 + 0.38 * Math.sin(t * 0.9)); ptr.y = H * (0.5 + 0.32 * Math.sin(t * 1.3 + 1))
        if (frame % 150 === 0) burst(ptr.x, ptr.y)
      }
      const dx = ptr.x - ptr.px, dy = ptr.y - ptr.py
      const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy)))
      for (let s = 0; s < steps; s++) {
        const k = s / steps
        for (let i = 0; i < Math.ceil(sparks / steps) + 1; i++) {
          parts.push({ x: ptr.px + dx * k, y: ptr.py + dy * k, vx: (Math.random() - 0.5) * 0.6 - dx * 0.05, vy: (Math.random() - 0.5) * 0.6 - dy * 0.05 - 0.15, life: 0, max: 20 + Math.random() * 30 })
        }
      }
      ptr.px = ptr.x; ptr.py = ptr.y

      // persistence: previous frame fades instead of clearing
      for (let i = 0; i < buf.length; i++) buf[i] *= 0.82
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]
        p.vy += 0.03
        p.vx *= 0.98; p.vy *= 0.98
        p.x += p.vx; p.y += p.vy
        if (++p.life > p.max) { parts.splice(i, 1); continue }
        plot(p.x, p.y, ramp(p.life / p.max))
      }
      for (let i = rings.length - 1; i >= 0; i--) {
        const g = rings[i]
        g.r += 1.3; g.life++
        const a = 1 - g.life / 40
        if (a <= 0) { rings.splice(i, 1); continue }
        const n = Math.ceil(g.r * 6)
        for (let k = 0; k < n; k++) { const ang = (k / n) * Math.PI * 2; plot(g.x + Math.cos(ang) * g.r, g.y + Math.sin(ang) * g.r, [120, 220, 255], a) }
      }
      if (parts.length > 4000) parts.splice(0, parts.length - 4000)
      const d = img.data
      for (let i = 0, j = 0; i < buf.length; i += 3, j += 4) {
        d[j] = 10 + buf[i]; d[j + 1] = 9 + buf[i + 1]; d[j + 2] = 14 + buf[i + 2]; d[j + 3] = 255
      }
      ctx.putImageData(img, 0, 0)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerleave', onLeave)
      canvas.removeEventListener('pointerdown', onDown)
    }
  }, [pixel, sparks, visible])

  return <canvas ref={canvasRef} className="fx-canvas" style={{ imageRendering: 'pixelated', cursor: 'crosshair' }} />
}
