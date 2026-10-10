import { useEffect, useRef, useState } from 'react'
import { useVisibility } from '../../hooks/useVisibility'
import './Fireflies.css'
import { targetDpr } from '../../lib/perf'

// pre-rendered glow sprite
function makeGlow(color) {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grd.addColorStop(0, 'rgba(255,255,230,1)')
  grd.addColorStop(0.12, color)
  grd.addColorStop(0.4, color.replace('1)', '0.25)'))
  grd.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 64, 64)
  return c
}

// night meadow silhouette, drawn once per resize
function drawBackdrop(ctx, W, H) {
  const sky = ctx.createLinearGradient(0, 0, 0, H)
  sky.addColorStop(0, '#04060d')
  sky.addColorStop(0.7, '#0b1420')
  sky.addColorStop(1, '#0f1d17')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  for (let i = 0; i < 90; i++) ctx.fillRect(Math.random() * W, Math.random() * H * 0.5, 1, 1)
  // tree line
  ctx.fillStyle = '#050a08'
  ctx.beginPath()
  ctx.moveTo(0, H)
  for (let x = 0; x <= W; x += 6) {
    const y = H * 0.7 - Math.abs(Math.sin(x * 0.013)) * H * 0.12 - Math.abs(Math.sin(x * 0.041 + 1)) * H * 0.05 - Math.random() * 6
    ctx.lineTo(x, y)
  }
  ctx.lineTo(W, H)
  ctx.fill()
  // grass blades in the foreground
  ctx.strokeStyle = '#020403'
  for (let i = 0; i < W / 2; i++) {
    const x = Math.random() * W, h = 20 + Math.random() * 60
    ctx.lineWidth = 1 + Math.random() * 1.5
    ctx.beginPath()
    ctx.moveTo(x, H)
    ctx.quadraticCurveTo(x + (Math.random() - 0.5) * 20, H - h * 0.6, x + (Math.random() - 0.5) * 30, H - h)
    ctx.stroke()
  }
}

/**
 * A swarm of fireflies: flocking (separation / alignment / cohesion) plus coupled
 * oscillators (Kuramoto model) so their flashes gradually fall into sync.
 * They drift toward the cursor; click to scatter them and break the rhythm.
 */
export default function Fireflies({ count = 180, coupling = 1.6, color = 'rgba(190,255,90,1)' }) {
  const canvasRef = useRef(null)
  const visible = useVisibility(canvasRef)
  const [sync, setSync] = useState(0)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const glow = makeGlow(color)
    const backdrop = document.createElement('canvas')
    let W = 0, H = 0, dpr = 1

    const flies = Array.from({ length: count }, () => ({
      x: 0, y: 0, vx: 0, vy: 0,
      phase: Math.random() * Math.PI * 2,
      freq: Math.PI * 2 * (0.55 + Math.random() * 0.2),
    }))
    const place = () => flies.forEach(f => {
      f.x = Math.random() * W
      f.y = H * (0.2 + Math.random() * 0.65)
      const a = Math.random() * Math.PI * 2
      f.vx = Math.cos(a) * 0.6; f.vy = Math.sin(a) * 0.6
    })

    const resize = () => {
      dpr = targetDpr(1.5)
      const r = canvas.getBoundingClientRect()
      W = r.width; H = r.height
      canvas.width = W * dpr; canvas.height = H * dpr
      backdrop.width = W * dpr; backdrop.height = H * dpr
      const b = backdrop.getContext('2d')
      b.setTransform(dpr, 0, 0, dpr, 0, 0)
      drawBackdrop(b, W, H)
      place()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const ptr = { x: 0, y: 0, inside: false }
    const onMove = e => {
      const r = canvas.getBoundingClientRect()
      ptr.x = e.clientX - r.left; ptr.y = e.clientY - r.top; ptr.inside = true
    }
    const onLeave = () => { ptr.inside = false }
    const onDown = () => flies.forEach(f => {
      const dx = f.x - ptr.x, dy = f.y - ptr.y, d = Math.hypot(dx, dy) + 1
      const kick = 900 / (d + 60)
      f.vx += (dx / d) * kick; f.vy += (dy / d) * kick
      f.phase = Math.random() * Math.PI * 2
    })
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerleave', onLeave)
    canvas.addEventListener('pointerdown', onDown)

    let raf, last = performance.now(), frame = 0
    const loop = now => {
      raf = requestAnimationFrame(loop)
      if (!visible.current) { last = now; return }
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now

      // flocking + phase coupling share the same neighbour scan
      const dPhase = new Float32Array(count)
      for (let i = 0; i < count; i++) {
        const a = flies[i]
        let sx = 0, sy = 0, ax = 0, ay = 0, cx = 0, cy = 0, n = 0, coupleSum = 0, coupleN = 0
        for (let j = 0; j < count; j++) {
          if (i === j) continue
          const b = flies[j]
          const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy
          if (d2 < 140 * 140) { coupleSum += Math.sin(b.phase - a.phase); coupleN++ }
          if (d2 > 60 * 60) continue
          n++
          ax += b.vx; ay += b.vy; cx += dx; cy += dy
          if (d2 < 18 * 18) { sx -= dx / (d2 + 1); sy -= dy / (d2 + 1) }
        }
        if (n) {
          a.vx += (ax / n - a.vx) * 0.02 + (cx / n) * 0.0006 + sx * 0.6
          a.vy += (ay / n - a.vy) * 0.02 + (cy / n) * 0.0006 + sy * 0.6
        }
        dPhase[i] = a.freq + (coupleN ? (coupling * coupleSum) / coupleN : 0)
      }

      let re = 0, im = 0
      for (let i = 0; i < count; i++) {
        const f = flies[i]
        f.phase = (f.phase + dPhase[i] * dt) % (Math.PI * 2)
        re += Math.cos(f.phase); im += Math.sin(f.phase)
        // wander, cursor attraction, soft walls, speed limits
        f.vx += (Math.random() - 0.5) * 0.12
        f.vy += (Math.random() - 0.5) * 0.12
        if (ptr.inside) {
          const dx = ptr.x - f.x, dy = ptr.y - f.y, d = Math.hypot(dx, dy) + 1
          if (d < 260) { f.vx += (dx / d) * 0.05; f.vy += (dy / d) * 0.05 }
        }
        if (f.x < 30) f.vx += 0.08
        if (f.x > W - 30) f.vx -= 0.08
        if (f.y < H * 0.12) f.vy += 0.08
        if (f.y > H * 0.88) f.vy -= 0.08
        const sp = Math.hypot(f.vx, f.vy)
        const max = 2.2, min = 0.35
        if (sp > max) { f.vx *= max / sp; f.vy *= max / sp }
        else if (sp < min) { f.vx *= min / (sp + 1e-3); f.vy *= min / (sp + 1e-3) }
        f.vx *= 0.995; f.vy *= 0.995
        f.x += f.vx * dt * 60
        f.y += f.vy * dt * 60
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.drawImage(backdrop, 0, 0)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.globalCompositeOperation = 'lighter'
      for (const f of flies) {
        // sharp flash near the top of each cycle, faint ember otherwise
        const flash = Math.pow(Math.max(0, Math.cos(f.phase)), 14)
        const s = 10 + flash * 26
        ctx.globalAlpha = 0.12 + flash * 0.88
        ctx.drawImage(glow, f.x - s, f.y - s, s * 2, s * 2)
      }
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
      if (++frame % 15 === 0) setSync(Math.hypot(re, im) / count)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerleave', onLeave)
      canvas.removeEventListener('pointerdown', onDown)
    }
  }, [count, coupling, color, visible])

  return (
    <div className="flies">
      <canvas ref={canvasRef} className="fx-canvas" />
      <div className="flies__hud">
        <span>synchrony</span>
        <div className="flies__meter"><i style={{ width: `${Math.round(sync * 100)}%` }} /></div>
        <b>{Math.round(sync * 100)}%</b>
      </div>
    </div>
  )
}
