import { useEffect, useRef } from 'react'
import { useVisibility } from '../hooks/useVisibility'

// compact 2D gradient noise
const perm = new Uint8Array(512)
{
  const p = Array.from({ length: 256 }, (_, i) => i)
  for (let i = 255; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [p[i], p[j]] = [p[j], p[i]] }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255]
}
const grad = (h, x, y) => ((h & 1) ? -x : x) + ((h & 2) ? -y : y)
function noise2(x, y) {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255
  x -= Math.floor(x); y -= Math.floor(y)
  const u = x * x * (3 - 2 * x), v = y * y * (3 - 2 * y)
  const a = perm[X] + Y, b = perm[X + 1] + Y
  const l1 = grad(perm[a], x, y) + u * (grad(perm[b], x - 1, y) - grad(perm[a], x, y))
  const l2 = grad(perm[a + 1], x, y - 1) + u * (grad(perm[b + 1], x - 1, y - 1) - grad(perm[a + 1], x, y - 1))
  return l1 + v * (l2 - l1)
}

/**
 * Stacked ridge-lines (a living "Unknown Pleasures" cover). Lines are drawn
 * back-to-front with filled occlusion; the cursor raises a mountain.
 */
export default function WaveLines({ rows = 46, points = 140, colors = ['#22d3ee', '#7c5cff', '#ff4fd8'] }) {
  const canvasRef = useRef(null)
  const visible = useVisibility(canvasRef)
  const colorsKey = colors.join('|')

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const cols = colorsKey.split('|')
    const mouse = { x: 0.5, y: 0.6, tx: 0.5, ty: 0.6, a: 0, ta: 0 }
    let W = 0, H = 0, dpr = 1

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio, 2)
      const r = canvas.getBoundingClientRect()
      W = r.width; H = r.height
      canvas.width = W * dpr; canvas.height = H * dpr
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const onMove = e => {
      const r = canvas.getBoundingClientRect()
      mouse.tx = (e.clientX - r.left) / r.width
      mouse.ty = (e.clientY - r.top) / r.height
      mouse.ta = 1
    }
    const onLeave = () => { mouse.ta = 0 }
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerleave', onLeave)

    const lerpColor = (t) => {
      const seg = t * (cols.length - 1)
      const i = Math.min(cols.length - 2, Math.floor(seg))
      const f = seg - i
      const c0 = parseInt(cols[i].slice(1), 16), c1 = parseInt(cols[i + 1].slice(1), 16)
      const ch = s => Math.round(((c0 >> s) & 255) * (1 - f) + ((c1 >> s) & 255) * f)
      return `rgb(${ch(16)},${ch(8)},${ch(0)})`
    }

    let raf
    const t0 = performance.now()
    const draw = () => {
      raf = requestAnimationFrame(draw)
      if (!visible.current) return
      const t = (performance.now() - t0) / 1000
      mouse.x += (mouse.tx - mouse.x) * 0.08
      mouse.y += (mouse.ty - mouse.y) * 0.08
      mouse.a += (mouse.ta - mouse.a) * 0.05

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = '#07070b'
      ctx.fillRect(0, 0, W, H)

      const top = H * 0.16, bottom = H * 0.94
      const marginX = W * 0.08
      for (let r = 0; r < rows; r++) {
        const rt = r / (rows - 1)                       // 0 = far (top), 1 = near (bottom)
        const baseY = top + (bottom - top) * rt
        const amp = H * (0.05 + rt * 0.12)
        const persp = 0.78 + rt * 0.22                  // far lines are narrower
        const x0 = W / 2 - (W / 2 - marginX) * persp
        const x1 = W / 2 + (W / 2 - marginX) * persp

        ctx.beginPath()
        for (let i = 0; i <= points; i++) {
          const u = i / points
          const x = x0 + (x1 - x0) * u
          const env = Math.exp(-Math.pow((u - 0.5) / 0.2, 2))   // calm edges, lively center
          let h = noise2(u * 5 + r * 0.31, r * 0.18 - t * 0.45) * 0.6 + noise2(u * 13 - t * 0.3, r * 0.4) * 0.25
          h = Math.max(0, h + 0.15) * env
          const mx = (x / W - mouse.x) * 4.2, my = (baseY / H - mouse.y) * 5
          h += Math.exp(-(mx * mx + my * my)) * 1.1 * mouse.a
          const y = baseY - h * amp * 1.6
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
        }
        ctx.lineTo(x1, baseY + 2)
        ctx.lineTo(x0, baseY + 2)
        ctx.closePath()
        ctx.fillStyle = '#07070b'
        ctx.fill()
        ctx.strokeStyle = lerpColor(rt)
        ctx.globalAlpha = 0.35 + rt * 0.65
        ctx.lineWidth = 1 + rt * 0.9
        ctx.stroke()
        ctx.globalAlpha = 1
      }
    }
    draw()
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerleave', onLeave)
    }
  }, [rows, points, colorsKey, visible])

  return <canvas ref={canvasRef} className="fx-canvas" />
}
