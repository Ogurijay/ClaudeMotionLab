import { useEffect, useRef } from 'react'
import { useVisibility } from '../../hooks/useVisibility'
import './TornReveal.css'
import { targetDpr } from '../../lib/perf'

// kraft paper with print, drawn once per size
function paintPaper(ctx, W, H) {
  ctx.fillStyle = '#c8a97a'
  ctx.fillRect(0, 0, W, H)
  for (let i = 0; i < W * H * 0.004; i++) {
    ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '90,60,30' : '255,240,210'},${Math.random() * 0.12})`
    ctx.fillRect(Math.random() * W, Math.random() * H, 1 + Math.random() * 3, 1)
  }
  ctx.fillStyle = 'rgba(60,40,20,0.85)'
  ctx.textAlign = 'center'
  ctx.font = `900 ${Math.min(H * 0.16, W * 0.12)}px "Inter Variable", Inter, "Arial Black", sans-serif`
  ctx.fillText('TEAR ME', W / 2, H * 0.45)
  ctx.font = `500 ${Math.max(12, H * 0.035)}px "JetBrains Mono", monospace`
  ctx.fillText('drag across the paper to rip it open', W / 2, H * 0.58)
  ctx.setLineDash([8, 7])
  ctx.strokeStyle = 'rgba(60,40,20,0.5)'
  ctx.lineWidth = 2
  ctx.strokeRect(24, 24, W - 48, H - 48)
  ctx.setLineDash([])
}

/**
 * A sheet of kraft paper over hidden content. Dragging rips a jagged strip
 * along the path: the torn edges show white fibres, and the strip flutters away
 * under gravity.
 */
export default function TornReveal({ stripWidth = 70 }) {
  const paperRef = useRef(null)
  const fxRef = useRef(null)
  const visible = useVisibility(paperRef)
  const resetRef = useRef(() => {})

  useEffect(() => {
    const paper = paperRef.current, fx = fxRef.current
    const pctx = paper.getContext('2d'), fctx = fx.getContext('2d')
    let W = 0, H = 0, dpr = 1
    const pieces = []
    let path = null

    const resize = () => {
      dpr = targetDpr(1.5)
      const r = paper.getBoundingClientRect()
      W = r.width; H = r.height
      for (const c of [paper, fx]) { c.width = W * dpr; c.height = H * dpr }
      pctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      fctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      pctx.globalCompositeOperation = 'source-over'
      paintPaper(pctx, W, H)
    }
    resize()
    resetRef.current = resize
    const ro = new ResizeObserver(resize)
    ro.observe(paper)

    // jagged outline around a stroke: offset each sample along its normal with jitter
    const outline = (pts, half, jag) => {
      const left = [], right = []
      for (let i = 0; i < pts.length; i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]
        let nx = -(b.y - a.y), ny = b.x - a.x
        const l = Math.hypot(nx, ny) || 1
        nx /= l; ny /= l
        left.push([pts[i].x + nx * (half + (Math.random() - 0.5) * jag), pts[i].y + ny * (half + (Math.random() - 0.5) * jag)])
        right.push([pts[i].x - nx * (half + (Math.random() - 0.5) * jag), pts[i].y - ny * (half + (Math.random() - 0.5) * jag)])
      }
      return left.concat(right.reverse())
    }
    const trace = (ctx, poly) => { ctx.beginPath(); poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath() }

    const tear = pts => {
      if (pts.length < 2) return
      const half = stripWidth / 2
      const outer = outline(pts, half + 3, 7)
      const inner = outline(pts, half - 2, 9)
      // capture the strip as a falling piece before cutting it out
      const xs = outer.map(p => p[0]), ys = outer.map(p => p[1])
      const x0 = Math.max(0, Math.min(...xs) - 4), y0 = Math.max(0, Math.min(...ys) - 4)
      const x1 = Math.min(W, Math.max(...xs) + 4), y1 = Math.min(H, Math.max(...ys) + 4)
      if (x1 - x0 < 2 || y1 - y0 < 2) return
      const piece = document.createElement('canvas')
      piece.width = (x1 - x0) * dpr; piece.height = (y1 - y0) * dpr
      const k = piece.getContext('2d')
      k.drawImage(paper, x0 * dpr, y0 * dpr, (x1 - x0) * dpr, (y1 - y0) * dpr, 0, 0, piece.width, piece.height)
      k.setTransform(dpr, 0, 0, dpr, -x0 * dpr, -y0 * dpr)
      k.globalCompositeOperation = 'destination-in'
      trace(k, inner); k.fill()
      // white fibrous rim left on the paper (source-atop: only where paper remains, never refilling earlier tears)
      pctx.globalCompositeOperation = 'source-atop'
      pctx.fillStyle = '#f7efe0'
      trace(pctx, outer); pctx.fill()
      pctx.globalCompositeOperation = 'destination-out'
      trace(pctx, inner); pctx.fill()
      pctx.globalCompositeOperation = 'source-over'
      pieces.push({ img: piece, x: x0, y: y0, w: x1 - x0, h: y1 - y0, vx: (Math.random() - 0.5) * 2, vy: -2 - Math.random() * 2, rot: 0, vr: (Math.random() - 0.5) * 0.08 })
    }

    const toLocal = e => { const r = paper.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top } }
    const onDown = e => { paper.setPointerCapture(e.pointerId); path = [toLocal(e)] }
    const onMove = e => {
      if (!path) return
      const p = toLocal(e), last = path[path.length - 1]
      if (Math.hypot(p.x - last.x, p.y - last.y) < 6) return
      path.push(p)
      // tear progressively in short segments so pieces come off while dragging
      if (path.length >= 8) { tear(path); path = path.slice(-1) }
    }
    const onUp = () => { if (path) tear(path); path = null }
    paper.addEventListener('pointerdown', onDown)
    paper.addEventListener('pointermove', onMove)
    paper.addEventListener('pointerup', onUp)
    paper.addEventListener('pointercancel', onUp)

    let raf
    const loop = () => {
      raf = requestAnimationFrame(loop)
      if (!visible.current && !pieces.length) return
      fctx.clearRect(0, 0, W, H)
      for (let i = pieces.length - 1; i >= 0; i--) {
        const p = pieces[i]
        p.vy += 0.35; p.vx *= 0.99
        p.x += p.vx; p.y += p.vy; p.rot += p.vr
        if (p.y > H + 200) { pieces.splice(i, 1); continue }
        fctx.save()
        fctx.translate(p.x + p.w / 2, p.y + p.h / 2)
        fctx.rotate(p.rot)
        fctx.shadowColor = 'rgba(0,0,0,0.35)'
        fctx.shadowBlur = 12
        fctx.shadowOffsetY = 6
        fctx.drawImage(p.img, -p.w / 2, -p.h / 2, p.w, p.h)
        fctx.restore()
      }
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      paper.removeEventListener('pointerdown', onDown)
      paper.removeEventListener('pointermove', onMove)
      paper.removeEventListener('pointerup', onUp)
      paper.removeEventListener('pointercancel', onUp)
    }
  }, [stripWidth, visible])

  return (
    <div className="torn">
      <div className="torn__under">
        <span className="torn__kicker">PP-03 · HIDDEN LAYER</span>
        <h3>Surprise!</h3>
        <p>Every strip you tear reveals a little more.</p>
      </div>
      <canvas ref={paperRef} className="torn__paper" />
      <canvas ref={fxRef} className="torn__fx" />
      <button className="torn__reset" onClick={() => resetRef.current()}>new sheet</button>
    </div>
  )
}
