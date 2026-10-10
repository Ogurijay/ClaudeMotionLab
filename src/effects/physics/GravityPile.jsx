import { useEffect, useRef } from 'react'
import { useVisibility } from '../../hooks/useVisibility'

const TAGS = ['React', 'Three.js', 'GLSL', 'WebGL2', 'Canvas', 'Verlet', 'Springs', 'Shaders', 'Particles',
  'Physics', 'Motion', 'Noise', 'SDF', 'Fluids', 'Cloth', 'Jelly', 'Pixels', 'Light', 'Ink', 'Paper']
const COLORS = ['#fb7185', '#f472b6', '#c084fc', '#60a5fa', '#34d399', '#facc15', '#fb923c', '#e5e7eb']

/**
 * Tags that rain down and pile up as rigid bodies — each a box of four Verlet
 * particles held by edge and diagonal constraints, colliding corner-against-edge.
 * Grab one to drag it around and fling it into the pile.
 */
export default function GravityPile({ tags = TAGS, gravity = 0.45 }) {
  const canvasRef = useRef(null)
  const visible = useVisibility(canvasRef)
  const tagsKey = tags.join('|')

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let W = 0, H = 0, dpr = 1, bodies = [], spawnQueue = [], lastSpawn = 0
    const labels = tagsKey.split('|')
    const font = '600 17px Inter, system-ui, sans-serif'

    // a body is 4 corner particles (x, y, px, py) plus 6 rest lengths (4 edges, 2 diagonals)
    const makeBody = (label, i) => {
      ctx.font = font
      const w = ctx.measureText(label).width + 36, h = 42
      const cx = W * (0.15 + Math.random() * 0.7), cy = -60 - Math.random() * 80
      const a = (Math.random() - 0.5) * 1.2
      const c = Math.cos(a), s = Math.sin(a)
      const local = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]
      const p = local.map(([x, y]) => { const X = cx + x * c - y * s, Y = cy + x * s + y * c; return { x: X, y: Y, px: X - (Math.random() - 0.5) * 2, py: Y } })
      const pairs = [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2], [1, 3]]
      return { label, w, h, p, color: COLORS[i % COLORS.length], cons: pairs.map(([i, j]) => [i, j, Math.hypot(p[i].x - p[j].x, p[i].y - p[j].y)]) }
    }

    const fill = () => {
      bodies = []
      spawnQueue = labels.map((l, i) => () => makeBody(l, i))
    }
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio, 2)
      const r = canvas.getBoundingClientRect()
      W = r.width; H = r.height
      canvas.width = W * dpr; canvas.height = H * dpr
      fill()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const inside = (pt, b) => {
      // point in convex quad (consistent winding)
      let sign = 0
      for (let i = 0; i < 4; i++) {
        const a = b.p[i], c = b.p[(i + 1) % 4]
        const cross = (c.x - a.x) * (pt.y - a.y) - (c.y - a.y) * (pt.x - a.x)
        if (cross !== 0) { if (sign && Math.sign(cross) !== sign) return false; sign = Math.sign(cross) }
      }
      return true
    }

    // grab
    let grab = null
    const ptr = { x: 0, y: 0 }
    const toLocal = e => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top } }
    const onDown = e => {
      const p = toLocal(e)
      for (let k = bodies.length - 1; k >= 0; k--) {
        const b = bodies[k]
        if (!inside(p, b)) continue
        // hold the body by its nearest corner, remembering the offset
        let best = 0, bd = Infinity
        b.p.forEach((q, i) => { const d = Math.hypot(q.x - p.x, q.y - p.y); if (d < bd) { bd = d; best = i } })
        grab = { b, i: best, ox: b.p[best].x - p.x, oy: b.p[best].y - p.y }
        Object.assign(ptr, p)
        canvas.setPointerCapture(e.pointerId)
        canvas.style.cursor = 'grabbing'
        return
      }
    }
    const onMove = e => Object.assign(ptr, toLocal(e))
    const onUp = () => { grab = null; canvas.style.cursor = 'grab' }
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)

    // probe points along A's edges (corners included); a probe's correction is shared
    // by the two corners it interpolates, so crossings without a corner inside are caught too
    const PROBES = [0, 0.25, 0.5, 0.75]
    const collide = (A, B) => {
      for (let e = 0; e < 4; e++) {
        const p0 = A.p[e], p1 = A.p[(e + 1) % 4]
        for (const s of PROBES) {
          const pt = { x: p0.x + (p1.x - p0.x) * s, y: p0.y + (p1.y - p0.y) * s }
          if (!inside(pt, B)) continue
          let best = null, bd = Infinity
          for (let i = 0; i < 4; i++) {
            const a = B.p[i], c = B.p[(i + 1) % 4]
            const ex = c.x - a.x, ey = c.y - a.y, len = Math.hypot(ex, ey) || 1e-6
            const nx = -ey / len, ny = ex / len
            const d = Math.abs((pt.x - a.x) * nx + (pt.y - a.y) * ny)
            if (d < bd) { bd = d; best = { a, c, nx, ny, t: Math.max(0, Math.min(1, ((pt.x - a.x) * ex + (pt.y - a.y) * ey) / (len * len))) } }
          }
          const { a, c, nx, ny, t } = best
          const side = Math.sign((pt.x - a.x) * nx + (pt.y - a.y) * ny) || 1
          const push = bd * side * 0.5
          // move A's probe out (split between its corners) and B's edge in the opposite direction
          p0.x -= nx * push * (1 - s); p0.y -= ny * push * (1 - s)
          p1.x -= nx * push * s; p1.y -= ny * push * s
          a.x += nx * push * (1 - t); a.y += ny * push * (1 - t)
          c.x += nx * push * t; c.y += ny * push * t
        }
      }
    }

    let raf
    const loop = now => {
      raf = requestAnimationFrame(loop)
      if (!visible.current) return
      if (spawnQueue.length && now - lastSpawn > 140) { bodies.push(spawnQueue.shift()()); lastSpawn = now }

      for (const b of bodies) for (const q of b.p) {
        const vx = (q.x - q.px) * 0.995, vy = (q.y - q.py) * 0.995
        q.px = q.x; q.py = q.y
        q.x += vx; q.y += vy + gravity
      }
      for (let it = 0; it < 8; it++) {
        for (const b of bodies) {
          for (const [i, j, rest] of b.cons) {
            const p = b.p[i], q = b.p[j]
            const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1e-6
            const k = ((d - rest) / d) * 0.5
            p.x += dx * k; p.y += dy * k; q.x -= dx * k; q.y -= dy * k
          }
          // walls and floor with friction
          for (const q of b.p) {
            if (q.y > H - 2) { q.y = H - 2; q.px += (q.x - q.px) * 0.4 }
            if (q.x < 2) { q.x = 2; q.py += (q.y - q.py) * 0.2 }
            if (q.x > W - 2) { q.x = W - 2; q.py += (q.y - q.py) * 0.2 }
          }
        }
        for (let a = 0; a < bodies.length; a++) for (let c = a + 1; c < bodies.length; c++) {
          const A = bodies[a], B = bodies[c]
          const ax = A.p.map(q => q.x), bx = B.p.map(q => q.x), ay = A.p.map(q => q.y), by = B.p.map(q => q.y)
          if (Math.max(...ax) < Math.min(...bx) || Math.max(...bx) < Math.min(...ax) || Math.max(...ay) < Math.min(...by) || Math.max(...by) < Math.min(...ay)) continue
          collide(A, B); collide(B, A)
        }
        if (grab) { const q = grab.b.p[grab.i]; q.x = ptr.x + grab.ox; q.y = ptr.y + grab.oy }
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = '#100b0e'
      ctx.fillRect(0, 0, W, H)
      ctx.font = font
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      for (const b of bodies) {
        const cx = (b.p[0].x + b.p[2].x) / 2, cy = (b.p[0].y + b.p[2].y) / 2
        const ang = Math.atan2(b.p[1].y - b.p[0].y, b.p[1].x - b.p[0].x)
        ctx.save()
        ctx.translate(cx, cy)
        ctx.rotate(ang)
        ctx.shadowColor = 'rgba(0,0,0,0.45)'
        ctx.shadowBlur = 10
        ctx.shadowOffsetY = 4
        ctx.fillStyle = b.color
        ctx.beginPath()
        ctx.roundRect(-b.w / 2, -b.h / 2, b.w, b.h, b.h / 2)
        ctx.fill()
        ctx.shadowColor = 'transparent'
        ctx.fillStyle = '#140a10'
        ctx.fillText(b.label, 0, 1)
        ctx.restore()
      }
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
    }
  }, [tagsKey, gravity, visible])

  return <canvas ref={canvasRef} className="fx-canvas" style={{ cursor: 'grab', touchAction: 'none' }} />
}
