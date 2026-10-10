import { useEffect, useRef, useState } from 'react'
import { useVisibility } from '../../hooks/useVisibility'
import './MagnetDots.css'
import { targetDpr } from '../../lib/perf'

/**
 * A field of iron filings that align with the magnetic field of the poles:
 * the cursor is a north pole, clicks drop alternating south/north poles.
 * Each needle eases toward the local field direction; strength sets length and glow.
 */
export default function MagnetDots({ spacing = 22, maxPoles = 4 }) {
  const canvasRef = useRef(null)
  const visible = useVisibility(canvasRef)
  const [poleCount, setPoleCount] = useState(0)
  const clearRef = useRef(() => {})

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let W = 0, H = 0, dpr = 1, needles = []
    let poles = []                       // { x, y, q }
    const ptr = { x: 0, y: 0, inside: false }

    const resize = () => {
      dpr = targetDpr(1.5)
      const r = canvas.getBoundingClientRect()
      W = r.width; H = r.height
      canvas.width = W * dpr; canvas.height = H * dpr
      needles = []
      for (let y = spacing / 2; y < H; y += spacing) for (let x = spacing / 2; x < W; x += spacing) {
        needles.push({ x, y, a: Math.random() * Math.PI, m: 0 })
      }
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const onMove = e => {
      const r = canvas.getBoundingClientRect()
      ptr.x = e.clientX - r.left; ptr.y = e.clientY - r.top; ptr.inside = true
    }
    const onLeave = () => { ptr.inside = false }
    const onDown = e => {
      onMove(e)
      poles.push({ x: ptr.x, y: ptr.y, q: poles.length % 2 ? 1 : -1 })
      if (poles.length > maxPoles) poles.shift()
      setPoleCount(poles.length)
    }
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerleave', onLeave)
    canvas.addEventListener('pointerdown', onDown)
    clearRef.current = () => { poles = []; setPoleCount(0) }

    const t0 = performance.now()
    let raf
    const loop = now => {
      raf = requestAnimationFrame(loop)
      if (!visible.current) return
      const t = (now - t0) / 1000
      // active poles: placed ones + the cursor (or a wandering pole when idle)
      const active = poles.slice()
      if (ptr.inside) active.push({ x: ptr.x, y: ptr.y, q: 1, cursor: true })
      else if (!poles.length) {
        active.push({ x: W * (0.5 + Math.cos(t * 0.5) * 0.28), y: H * (0.5 + Math.sin(t * 0.7) * 0.25), q: 1, cursor: true })
        active.push({ x: W * (0.5 - Math.cos(t * 0.5) * 0.28), y: H * (0.5 - Math.sin(t * 0.7) * 0.25), q: -1 })
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = '#0b0a0d'
      ctx.fillRect(0, 0, W, H)
      ctx.lineCap = 'round'
      for (const nd of needles) {
        let bx = 0, by = 0, near = 0
        for (const p of active) {
          const dx = nd.x - p.x, dy = nd.y - p.y
          const r2 = dx * dx + dy * dy + 400
          const inv = p.q / (r2 * Math.sqrt(r2))
          bx += dx * inv; by += dy * inv
          near += p.q / Math.sqrt(r2)
        }
        const mag = Math.hypot(bx, by)
        // needles are axial (no head/tail), so ease toward the field angle modulo π
        const target = Math.atan2(by, bx)
        let da = ((target - nd.a + Math.PI / 2) % Math.PI + Math.PI) % Math.PI - Math.PI / 2
        nd.a += da * 0.18
        const strength = Math.min(1, mag * 9000)
        nd.m += (strength - nd.m) * 0.15
        const len = 3 + nd.m * (spacing * 0.42)
        const cx = Math.cos(nd.a) * len, cy = Math.sin(nd.a) * len
        // tint by polarity of the nearest influence: north warm, south cool
        const warm = Math.max(0, Math.min(1, 0.5 + near * 30))
        const r = Math.round(90 + 165 * warm * nd.m + 60 * (1 - nd.m))
        const g = Math.round(80 + 60 * nd.m)
        const b = Math.round(110 + 145 * (1 - warm) * nd.m + 40 * (1 - nd.m))
        ctx.strokeStyle = `rgba(${r},${g},${b},${0.25 + nd.m * 0.75})`
        ctx.lineWidth = 1 + nd.m * 1.6
        ctx.beginPath()
        ctx.moveTo(nd.x - cx, nd.y - cy)
        ctx.lineTo(nd.x + cx, nd.y + cy)
        ctx.stroke()
      }
      // pole markers
      for (const p of active) {
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.cursor ? 14 : 12, 0, Math.PI * 2)
        ctx.fillStyle = p.q > 0 ? '#fb7185' : '#60a5fa'
        ctx.fill()
        ctx.fillStyle = '#0b0a0d'
        ctx.font = '700 12px "JetBrains Mono", monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(p.q > 0 ? 'N' : 'S', p.x, p.y + 1)
      }
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerleave', onLeave)
      canvas.removeEventListener('pointerdown', onDown)
    }
  }, [spacing, maxPoles, visible])

  return (
    <div className="magnet">
      <canvas ref={canvasRef} className="fx-canvas" />
      <div className="magnet__hud">
        <span>poles {poleCount}/{maxPoles}</span>
        <button onClick={() => clearRef.current()}>clear</button>
      </div>
    </div>
  )
}
