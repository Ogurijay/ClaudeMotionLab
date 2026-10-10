import { useEffect, useRef, useState } from 'react'
import { useVisibility } from '../../hooks/useVisibility'
import './FallingSand.css'

const EMPTY = 0, SAND = 1, WATER = 2, STONE = 3, WOOD = 4, FIRE = 5, SMOKE = 6

const TOOLS = [
  { id: SAND, label: 'Sand', swatch: '#e8c66f' },
  { id: WATER, label: 'Water', swatch: '#3b82f6' },
  { id: STONE, label: 'Stone', swatch: '#7a7a88' },
  { id: WOOD, label: 'Wood', swatch: '#8a5232' },
  { id: FIRE, label: 'Fire', swatch: '#ff7a1a' },
  { id: EMPTY, label: 'Erase', swatch: '#1a1a22' },
]

// colour per material, modulated by a per-cell shade so piles look granular (packed as 0xAABBGGRR)
function colorOf(type, shade, life, t) {
  const v = shade / 255
  let r, g, b
  switch (type) {
    case SAND: r = 222 + v * 30; g = 186 + v * 26; b = 98 + v * 22; break
    case WATER: { const s = Math.sin(t * 0.004 + shade) * 12; r = 40 + s; g = 110 + v * 30 + s; b = 230; break }
    case STONE: r = g = 100 + v * 34; b = 112 + v * 34; break
    case WOOD: r = 120 + v * 30; g = 72 + v * 16; b = 40 + v * 10; break
    case FIRE: { const k = Math.min(1, life / 50); r = 255; g = 80 + k * 150 * v; b = 20 + k * 40; break }
    case SMOKE: { const k = Math.min(1, life / 90); r = g = b = 11 + k * 60; break }
    default: r = 11; g = 11; b = 16
  }
  return (255 << 24) | (Math.min(255, b) << 16) | (Math.min(255, g) << 8) | Math.min(255, r)
}

/**
 * Pixel sandbox: a cellular automaton with sand, water, stone, wood, fire and smoke.
 * Sand piles and sinks through water, water levels out, fire climbs wood and leaves smoke.
 * Drag to paint with the selected material.
 */
export default function FallingSand({ cellSize = 4, brushSize = 3 }) {
  const canvasRef = useRef(null)
  const visible = useVisibility(canvasRef)
  const [tool, setTool] = useState(SAND)
  const toolRef = useRef(tool)
  toolRef.current = tool
  const resetRef = useRef(() => {})

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let W = 0, H = 0, type, shade, life, stamp, img, buf, clock = 0
    let emitUntil = 0

    const idx = (x, y) => y * W + x
    const inb = (x, y) => x >= 0 && x < W && y >= 0 && y < H
    const set = (x, y, t, l = 0) => {
      const i = idx(x, y)
      type[i] = t
      shade[i] = (Math.random() * 255) | 0
      life[i] = l
    }
    const swap = (a, b) => {
      let t = type[a]; type[a] = type[b]; type[b] = t
      t = shade[a]; shade[a] = shade[b]; shade[b] = t
      t = life[a]; life[a] = life[b]; life[b] = t
      stamp[a] = stamp[b] = clock
    }

    // a small starter scene so the sandbox looks alive before anyone touches it
    const seedScene = () => {
      type.fill(EMPTY)
      const ledge = (x0, x1, y) => { for (let x = x0; x < x1; x++) for (let k = 0; k < 2; k++) if (inb(x, y + k)) set(x, y + k, STONE) }
      ledge((W * 0.08) | 0, (W * 0.38) | 0, (H * 0.42) | 0)
      ledge((W * 0.6) | 0, (W * 0.92) | 0, (H * 0.58) | 0)
      for (let y = H - 1; y > H - 4; y--) for (let x = 0; x < W; x++) set(x, y, STONE)
      // wood pile with a small fire under it
      const wx = (W * 0.72) | 0, wy = (H * 0.58) | 0
      for (let y = wy - 10; y < wy; y++) for (let x = wx - 14 + (wy - y); x < wx + 14 - (wy - y); x++) if (inb(x, y)) set(x, y, WOOD)
      // sand dune
      for (let x = 0; x < W; x++) {
        const h = Math.max(0, Math.sin((x / W) * Math.PI) * H * 0.12 - 2)
        for (let y = H - 4; y > H - 4 - h; y--) set(x, y, SAND)
      }
      emitUntil = performance.now() + 7000
    }

    const resize = () => {
      const r = canvas.getBoundingClientRect()
      W = Math.max(40, Math.round(r.width / cellSize))
      H = Math.max(30, Math.round(r.height / cellSize))
      canvas.width = W
      canvas.height = H
      type = new Uint8Array(W * H)
      shade = new Uint8Array(W * H)
      life = new Uint8Array(W * H)
      stamp = new Uint32Array(W * H)
      img = ctx.createImageData(W, H)
      buf = new Uint32Array(img.data.buffer)
      seedScene()
    }
    resize()
    resetRef.current = seedScene
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    // pointer painting, interpolated between frames so fast strokes stay continuous
    const ptr = { down: false, x: 0, y: 0, px: 0, py: 0 }
    const toCell = e => {
      const r = canvas.getBoundingClientRect()
      return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H]
    }
    const onDown = e => {
      canvas.setPointerCapture(e.pointerId)
      ptr.down = true
      ;[ptr.x, ptr.y] = toCell(e)
      ptr.px = ptr.x; ptr.py = ptr.y
    }
    const onMove = e => { [ptr.x, ptr.y] = toCell(e) }
    const onUp = () => { ptr.down = false }
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)

    const paint = (cx, cy) => {
      const t = toolRef.current
      for (let dy = -brushSize; dy <= brushSize; dy++) for (let dx = -brushSize; dx <= brushSize; dx++) {
        if (dx * dx + dy * dy > brushSize * brushSize) continue
        const x = (cx + dx) | 0, y = (cy + dy) | 0
        if (!inb(x, y)) continue
        const granular = t === SAND || t === WATER || t === FIRE
        if (granular && Math.random() < 0.45) continue
        if (t !== EMPTY && type[idx(x, y)] !== EMPTY && t !== STONE && t !== WOOD) continue
        set(x, y, t, t === FIRE ? 30 + Math.random() * 30 : 0)
      }
    }

    const isFluidOrGas = t => t === EMPTY || t === WATER || t === SMOKE
    const step = () => {
      clock++
      const ltr = clock & 1
      for (let y = H - 1; y >= 0; y--) {
        for (let k = 0; k < W; k++) {
          const x = ltr ? k : W - 1 - k
          const i = idx(x, y)
          const t = type[i]
          if (t === EMPTY || t === STONE || t === WOOD || stamp[i] === clock) continue
          const dir = Math.random() < 0.5 ? -1 : 1

          if (t === SAND) {
            if (y + 1 < H) {
              const b = idx(x, y + 1)
              if (type[b] === EMPTY || type[b] === SMOKE || (type[b] === WATER && Math.random() < 0.6)) { swap(i, b); continue }
              for (const d of [dir, -dir]) {
                if (inb(x + d, y + 1) && isFluidOrGas(type[idx(x + d, y + 1)])) { swap(i, idx(x + d, y + 1)); break }
              }
            }
          } else if (t === WATER) {
            if (y + 1 < H && (type[idx(x, y + 1)] === EMPTY || type[idx(x, y + 1)] === SMOKE)) { swap(i, idx(x, y + 1)); continue }
            let moved = false
            for (const d of [dir, -dir]) {
              if (inb(x + d, y + 1) && type[idx(x + d, y + 1)] === EMPTY) { swap(i, idx(x + d, y + 1)); moved = true; break }
            }
            if (moved) continue
            // flow sideways up to 4 cells
            let tx = x
            for (let s = 1; s <= 4; s++) { if (inb(x + dir * s, y) && type[idx(x + dir * s, y)] === EMPTY) tx = x + dir * s; else break }
            if (tx !== x) swap(i, idx(tx, y))
          } else if (t === FIRE) {
            // ignite wood, get doused by water
            let doused = false
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
              if (!inb(x + dx, y + dy)) continue
              const n = idx(x + dx, y + dy)
              if (type[n] === WOOD && Math.random() < 0.04) { set(x + dx, y + dy, FIRE, 70 + Math.random() * 80); stamp[n] = clock }
              if (type[n] === WATER) doused = true
            }
            if (doused || life[i] <= 1) { set(x, y, Math.random() < 0.6 ? SMOKE : EMPTY, 60 + Math.random() * 60); stamp[i] = clock; continue }
            life[i]--
            if (Math.random() < 0.5) {
              const nx = x + ((Math.random() * 3) | 0) - 1
              if (inb(nx, y - 1) && type[idx(nx, y - 1)] === EMPTY) swap(i, idx(nx, y - 1))
            }
          } else if (t === SMOKE) {
            if (life[i] <= 1) { type[i] = EMPTY; continue }
            life[i]--
            const nx = x + ((Math.random() * 3) | 0) - 1
            if (inb(nx, y - 1) && type[idx(nx, y - 1)] === EMPTY) swap(i, idx(nx, y - 1))
            else if (y === 0) type[i] = EMPTY
          }
        }
      }
    }

    let raf
    const loop = now => {
      raf = requestAnimationFrame(loop)
      if (!visible.current) return
      if (now < emitUntil) {
        for (let k = 0; k < 3; k++) {
          const sx = ((W * 0.2) | 0) + ((Math.random() * 4) | 0), wx = ((W * 0.82) | 0) + ((Math.random() * 4) | 0)
          if (type[idx(sx, 1)] === EMPTY) set(sx, 1, SAND)
          if (type[idx(wx, 1)] === EMPTY) set(wx, 1, WATER)
        }
        // kindle the wood pile from inside so the fire catches
        if (now > emitUntil - 4000 && Math.random() < 0.05) set(((W * 0.72) | 0) + ((Math.random() * 10) | 0) - 5, ((H * 0.58) | 0) - 2, FIRE, 120)
      }
      if (ptr.down) {
        const steps = Math.max(1, Math.ceil(Math.hypot(ptr.x - ptr.px, ptr.y - ptr.py) / 2))
        for (let s = 1; s <= steps; s++) paint(ptr.px + ((ptr.x - ptr.px) * s) / steps, ptr.py + ((ptr.y - ptr.py) * s) / steps)
        ptr.px = ptr.x; ptr.py = ptr.y
      }
      step()
      step()
      for (let i = 0; i < W * H; i++) buf[i] = colorOf(type[i], shade[i], life[i], now)
      ctx.putImageData(img, 0, 0)
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
  }, [cellSize, brushSize, visible])

  return (
    <div className="sand">
      <canvas ref={canvasRef} className="sand__canvas" />
      <div className="sand__tools">
        {TOOLS.map(t => (
          <button key={t.id} className={tool === t.id ? 'is-active' : ''} onClick={() => setTool(t.id)}>
            <i style={{ background: t.swatch }} />{t.label}
          </button>
        ))}
        <button onClick={() => resetRef.current()}>Reset</button>
      </div>
    </div>
  )
}
