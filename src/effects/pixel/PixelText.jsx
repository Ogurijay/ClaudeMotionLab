import { useEffect, useRef } from 'react'
import { useVisibility } from '../../hooks/useVisibility'
import { targetDpr } from '../../lib/perf'

const PALETTE = ['#fde047', '#facc15', '#fb923c', '#f472b6', '#c084fc']

/**
 * Text built from pixel blocks that drop in like Tetris pieces, bottom rows
 * first, and settle with a bounce. Blocks near the cursor hop; a click blows
 * the word apart and it rebuilds itself.
 */
export default function PixelText({ text = 'PIXEL', cell = 14 }) {
  const canvasRef = useRef(null)
  const visible = useVisibility(canvasRef)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let W = 0, H = 0, dpr = 1, blocks = [], t0 = 0, rows = 0, rebuild = 0
    const ptr = { x: -999, y: -999 }

    const build = () => {
      dpr = targetDpr(1.5)
      const r = canvas.getBoundingClientRect()
      W = r.width; H = r.height
      canvas.width = W * dpr; canvas.height = H * dpr
      // sample the word on the block grid
      const off = document.createElement('canvas')
      off.width = Math.ceil(W / cell); off.height = Math.ceil(H / cell)
      const g = off.getContext('2d')
      g.fillStyle = '#fff'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.font = `900 ${Math.min(off.height * 0.62, off.width / (text.length * 0.72))}px "Inter Variable", Inter, "Arial Black", sans-serif`
      g.fillText(text, off.width / 2, off.height * 0.52)
      const data = g.getImageData(0, 0, off.width, off.height).data
      blocks = []
      let minRow = Infinity, maxRow = 0
      for (let y = 0; y < off.height; y++) for (let x = 0; x < off.width; x++) {
        if (data[(y * off.width + x) * 4 + 3] > 120) {
          blocks.push({ col: x, row: y, tx: x * cell, ty: y * cell, x: x * cell, y: 0, vx: 0, vy: 0, rot: 0, vr: 0, mode: 'drop', delay: 0, hop: 0 })
          minRow = Math.min(minRow, y); maxRow = Math.max(maxRow, y)
        }
      }
      rows = maxRow - minRow + 1
      blocks.forEach(b => { b.color = PALETTE[Math.min(PALETTE.length - 1, Math.floor(((b.row - minRow) / rows) * PALETTE.length))] })
      drop()
    }
    const drop = () => {
      t0 = performance.now()
      const maxRow = Math.max(...blocks.map(b => b.row))
      for (const b of blocks) {
        b.mode = 'drop'
        b.x = b.tx; b.y = -cell - Math.random() * H * 0.3
        b.vy = 0; b.rot = 0; b.vr = 0
        b.delay = (maxRow - b.row) * 55 + Math.random() * 260 + (b.col % 5) * 25
      }
    }
    build()
    const ro = new ResizeObserver(build)
    ro.observe(canvas)

    const onMove = e => { const r = canvas.getBoundingClientRect(); ptr.x = e.clientX - r.left; ptr.y = e.clientY - r.top }
    const onLeave = () => { ptr.x = ptr.y = -999 }
    const onDown = e => {
      const r = canvas.getBoundingClientRect()
      const cx = e.clientX - r.left, cy = e.clientY - r.top
      for (const b of blocks) {
        const dx = b.x - cx, dy = b.y - cy, d = Math.hypot(dx, dy) + 20
        b.mode = 'fly'
        b.vx = (dx / d) * (6 + Math.random() * 8)
        b.vy = (dy / d) * (6 + Math.random() * 8) - 6
        b.vr = (Math.random() - 0.5) * 0.6
      }
      t0 = performance.now()
      clearTimeout(rebuild)
      rebuild = setTimeout(drop, 1700)
    }
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerleave', onLeave)
    canvas.addEventListener('pointerdown', onDown)

    let raf
    const loop = now => {
      raf = requestAnimationFrame(loop)
      if (!visible.current) return
      const e = now - t0
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = '#0c0a09'
      ctx.fillRect(0, 0, W, H)
      // faint backdrop grid
      ctx.fillStyle = 'rgba(250,204,21,0.05)'
      for (let x = 0; x < W; x += cell) for (let y = 0; y < H; y += cell) ctx.fillRect(x, y, 1, 1)

      for (const b of blocks) {
        if (b.mode === 'drop') {
          if (e < b.delay) continue
          b.vy += 1.4
          b.y += b.vy
          if (b.y >= b.ty) { b.y = b.ty; b.vy = Math.abs(b.vy) > 3 ? -b.vy * 0.28 : 0; if (!b.vy) b.mode = 'rest' }
        } else if (b.mode === 'fly') {
          b.vy += 0.6
          b.x += b.vx; b.y += b.vy; b.rot += b.vr
          if (b.y > H - cell) { b.y = H - cell; b.vy *= -0.45; b.vx *= 0.8; b.vr *= 0.7 }
          if (b.x < 0 || b.x > W - cell) b.vx *= -0.8
        }
        // blocks near the cursor hop
        const near = Math.hypot(b.x + cell / 2 - ptr.x, b.y + cell / 2 - ptr.y)
        b.hop += ((b.mode === 'rest' && near < 70 ? (1 - near / 70) * 10 : 0) - b.hop) * 0.25
        const size = cell - 2
        ctx.save()
        ctx.translate(b.x + cell / 2, b.y + cell / 2 - b.hop)
        if (b.rot) ctx.rotate(b.rot)
        ctx.fillStyle = b.color
        ctx.fillRect(-size / 2, -size / 2, size, size)
        ctx.fillStyle = 'rgba(255,255,255,0.35)'
        ctx.fillRect(-size / 2, -size / 2, size, 2)
        ctx.fillStyle = 'rgba(0,0,0,0.25)'
        ctx.fillRect(-size / 2, size / 2 - 2, size, 2)
        ctx.restore()
      }
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(rebuild)
      ro.disconnect()
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerleave', onLeave)
      canvas.removeEventListener('pointerdown', onDown)
    }
  }, [text, cell, visible])

  return <canvas ref={canvasRef} className="fx-canvas" style={{ cursor: 'pointer' }} />
}
