import { useEffect, useRef } from 'react'
import './LiquidButton.css'
import { targetDpr } from '../../lib/perf'

const N = 36   // surface spring points

/**
 * A button that fills with sloshing liquid on hover: a 1D spring-chain surface
 * splashes where the cursor enters, tilts with horizontal movement and drains
 * on leave. The label inverts colour where the liquid covers it.
 */
export default function LiquidButton({ label = 'Get started', color = '#38bdf8', ink = '#04131c', onClick }) {
  const btnRef = useRef(null)
  const canvasRef = useRef(null)

  useEffect(() => {
    const btn = btnRef.current, canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let W = 0, H = 0, dpr = 1
    const h = new Float32Array(N), v = new Float32Array(N)
    const bubbles = []
    let level = 0, target = 0, lastX = 0, raf = 0, running = false

    const resize = () => {
      dpr = targetDpr(1.5)
      const r = btn.getBoundingClientRect()
      W = r.width; H = r.height
      canvas.width = W * dpr; canvas.height = H * dpr
      draw(performance.now())
    }

    const splash = (x, amount) => {
      const i = Math.max(0, Math.min(N - 1, Math.round((x / W) * (N - 1))))
      for (let k = -3; k <= 3; k++) if (h[i + k] !== undefined) v[i + k] += amount * (1 - Math.abs(k) / 4)
    }
    const onEnter = e => {
      const r = btn.getBoundingClientRect()
      lastX = e.clientX - r.left
      target = 1.12
      splash(lastX, -H * 0.5)
      start()
    }
    const onMove = e => {
      const r = btn.getBoundingClientRect()
      const x = e.clientX - r.left
      const dx = x - lastX
      lastX = x
      // horizontal motion tilts the liquid: push one side down, the other up
      for (let i = 0; i < N; i++) v[i] += dx * 0.06 * ((i / (N - 1)) - 0.5)
      start()
    }
    const onLeave = () => { target = 0; start() }
    btn.addEventListener('pointerenter', onEnter)
    btn.addEventListener('pointermove', onMove)
    btn.addEventListener('pointerleave', onLeave)

    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)
      const fontSize = Math.round(H * 0.36)
      ctx.font = `600 ${fontSize}px "Inter Variable", Inter, system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = color
      ctx.fillText(label, W / 2, H / 2 + 1)
      if (level < 0.002) return
      // liquid body
      const base = H * (1 - level)
      ctx.beginPath()
      ctx.moveTo(0, H)
      for (let i = 0; i < N; i++) ctx.lineTo((i / (N - 1)) * W, base + h[i])
      ctx.lineTo(W, H)
      ctx.closePath()
      ctx.save()
      ctx.fillStyle = color
      ctx.fill()
      ctx.clip()
      ctx.fillStyle = 'rgba(255,255,255,0.35)'
      for (const b of bubbles) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill() }
      ctx.fillStyle = ink
      ctx.fillText(label, W / 2, H / 2 + 1)
      ctx.restore()
      // bright meniscus line
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      for (let i = 0; i < N; i++) { const x = (i / (N - 1)) * W, y = base + h[i]; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y) }
      ctx.stroke()
    }

    const step = now => {
      level += (target - level) * 0.07
      // springs: each point returns to rest and pulls its neighbours
      for (let i = 0; i < N; i++) v[i] += -h[i] * 0.03
      for (let pass = 0; pass < 2; pass++) for (let i = 0; i < N; i++) {
        const l = h[i - 1] ?? h[i], r = h[i + 1] ?? h[i]
        v[i] += (l + r - 2 * h[i]) * 0.12
      }
      let energy = 0
      for (let i = 0; i < N; i++) { v[i] *= 0.95; h[i] += v[i]; energy += Math.abs(v[i]) + Math.abs(h[i]) * 0.1 }
      if (level > 0.05 && Math.random() < 0.25) bubbles.push({ x: Math.random() * W, y: H + 4, r: 1 + Math.random() * 2.5, vy: 0.4 + Math.random() * 0.8 })
      for (let i = bubbles.length - 1; i >= 0; i--) { const b = bubbles[i]; b.y -= b.vy; if (b.y < H * (1 - level)) bubbles.splice(i, 1) }
      draw(now)
      // stop animating once everything is at rest
      if (Math.abs(target - level) < 0.002 && energy < 0.05 && !bubbles.length) { running = false; return }
      raf = requestAnimationFrame(step)
    }
    function start() { if (!running) { running = true; raf = requestAnimationFrame(step) } }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(btn)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      btn.removeEventListener('pointerenter', onEnter)
      btn.removeEventListener('pointermove', onMove)
      btn.removeEventListener('pointerleave', onLeave)
    }
  }, [label, color, ink])

  return (
    <button ref={btnRef} className="lbtn" style={{ '--lbtn': color }} onClick={onClick} aria-label={label}>
      <canvas ref={canvasRef} aria-hidden="true" />
    </button>
  )
}
