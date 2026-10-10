import { useEffect, useRef } from 'react'
import { useVisibility } from '../../hooks/useVisibility'

const FLOWERS = ['#f9a8d4', '#fde68a', '#f5f5f4', '#c4b5fd']

/**
 * Vines that sprout from the edges and climb across the canvas: stems curl and
 * branch, leaves unfurl along them, and the tips bloom into flowers. Click to
 * plant a new vine; the garden regrows after it has fully bloomed.
 */
export default function GrowingVines({ seeds = 7, maxDepth = 4 }) {
  const canvasRef = useRef(null)
  const visible = useVisibility(canvasRef)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let W = 0, H = 0, dpr = 1, agents = [], doneAt = 0

    const sprout = (x, y, angle, width = 5, depth = 0, life = 260) => {
      agents.push({ x, y, angle, width, depth, life, age: 0, curl: (Math.random() - 0.5) * 0.04, side: 1 })
    }
    const plantAll = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = '#0a110b'
      ctx.fillRect(0, 0, W, H)
      agents = []
      for (let i = 0; i < seeds; i++) {
        const fromSide = i % 3 === 2
        if (fromSide) sprout(i % 2 ? W : 0, H * (0.4 + Math.random() * 0.5), i % 2 ? Math.PI * 1.05 : -0.05)
        else sprout(W * ((i + 0.5) / seeds) + (Math.random() - 0.5) * 40, H + 2, -Math.PI / 2 + (Math.random() - 0.5) * 0.5)
      }
      doneAt = 0
    }
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio, 2)
      const r = canvas.getBoundingClientRect()
      W = r.width; H = r.height
      canvas.width = W * dpr; canvas.height = H * dpr
      plantAll()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const onDown = e => {
      const r = canvas.getBoundingClientRect()
      sprout(e.clientX - r.left, e.clientY - r.top, -Math.PI / 2 + (Math.random() - 0.5), 4.5, 0, 200)
    }
    canvas.addEventListener('pointerdown', onDown)

    const leaf = (x, y, a, size) => {
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(a)
      const g = ctx.createLinearGradient(0, 0, size * 2, 0)
      g.addColorStop(0, '#2f6b2f')
      g.addColorStop(1, '#7dbb47')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.quadraticCurveTo(size, -size * 0.7, size * 2, 0)
      ctx.quadraticCurveTo(size, size * 0.7, 0, 0)
      ctx.fill()
      ctx.restore()
    }
    const flower = (x, y, size) => {
      const c = FLOWERS[(Math.random() * FLOWERS.length) | 0]
      const rot = Math.random() * Math.PI
      ctx.fillStyle = c
      for (let k = 0; k < 5; k++) {
        const a = rot + (k / 5) * Math.PI * 2
        ctx.beginPath()
        ctx.ellipse(x + Math.cos(a) * size, y + Math.sin(a) * size, size * 0.9, size * 0.5, a, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.fillStyle = '#facc15'
      ctx.beginPath(); ctx.arc(x, y, size * 0.45, 0, Math.PI * 2); ctx.fill()
    }

    let raf
    const loop = now => {
      raf = requestAnimationFrame(loop)
      if (!visible.current) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.lineCap = 'round'
      const next = []
      for (const a of agents) {
        for (let s = 0; s < 2; s++) {
          a.age++
          const k = a.age / a.life
          // curl tighter near the end of life, like a tendril
          a.angle += a.curl + Math.sin(a.age * 0.05 + a.depth) * 0.012 + (k > 0.8 ? 0.06 * a.side : 0)
          // near an edge, turn gently back toward the middle of the canvas
          if (a.x < 30 || a.x > W - 30 || a.y < 30) {
            const d = Math.atan2(H * 0.5 - a.y, W * 0.5 - a.x) - a.angle
            a.angle += Math.atan2(Math.sin(d), Math.cos(d)) * 0.05
          }
          const nx = a.x + Math.cos(a.angle) * 1.6, ny = a.y + Math.sin(a.angle) * 1.6
          const w = Math.max(0.6, a.width * (1 - k * 0.85))
          ctx.strokeStyle = `rgb(${40 + a.depth * 12}, ${80 + a.depth * 14}, ${42 + a.depth * 6})`
          ctx.lineWidth = w
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(nx, ny); ctx.stroke()
          a.x = nx; a.y = ny
          if (a.age % 22 === 0 && k < 0.9) { a.side *= -1; leaf(a.x, a.y, a.angle + a.side * 1.0, 5 + w * 1.4) }
          if (a.depth < maxDepth && Math.random() < 0.012 && k > 0.15 && k < 0.8) {
            next.push({ x: a.x, y: a.y, angle: a.angle + (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.5), width: w * 0.75, depth: a.depth + 1, life: a.life * 0.6, age: 0, curl: (Math.random() - 0.5) * 0.05, side: 1 })
          }
          if (a.age >= a.life) { if (Math.random() < 0.85) flower(a.x, a.y, 4 + (maxDepth - a.depth) * 1.5); a.dead = true; break }
        }
      }
      agents = agents.filter(a => !a.dead).concat(next)
      // when everything has bloomed, hold, then fade and replant
      if (!agents.length) {
        doneAt ||= now
        if (now - doneAt > 4500) {
          ctx.fillStyle = 'rgba(10,17,11,0.08)'
          ctx.fillRect(0, 0, W, H)
          if (now - doneAt > 6500) plantAll()
        }
      }
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointerdown', onDown)
    }
  }, [seeds, maxDepth, visible])

  return <canvas ref={canvasRef} className="fx-canvas" style={{ cursor: 'copy' }} />
}
