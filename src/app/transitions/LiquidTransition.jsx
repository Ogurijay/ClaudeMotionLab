import { useEffect, useRef } from 'react'
import DefaultIntro from './DefaultIntro.jsx'

/** Liquid chapter intro: the header starts underwater, then the water drains away with a rolling surface and bubbles. */
export default function LiquidTransition({ category, active }) {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas.getContext('2d')
    const r = canvas.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio, 2)
    const W = r.width, H = r.height
    canvas.width = W * dpr
    canvas.height = H * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const bubbles = Array.from({ length: 40 }, () => ({ x: Math.random() * W, y: H * (0.3 + Math.random() * 0.7), r: 2 + Math.random() * 6, v: 40 + Math.random() * 90 }))

    const draw = (level, t) => {
      ctx.clearRect(0, 0, W, H)
      const surface = x => level + Math.sin(x * 0.012 + t * 3) * 14 + Math.sin(x * 0.031 - t * 2.2) * 6
      for (const [offset, color] of [[10, 'rgba(56,189,248,0.35)'], [0, 'rgba(14,116,170,0.92)']]) {
        ctx.beginPath()
        ctx.moveTo(0, H)
        for (let x = 0; x <= W; x += 12) ctx.lineTo(x, surface(x + offset * 20) - offset)
        ctx.lineTo(W, H)
        ctx.closePath()
        ctx.fillStyle = color
        ctx.fill()
      }
      ctx.fillStyle = 'rgba(224,242,254,0.55)'
      for (const b of bubbles) {
        const y = b.y - t * b.v
        if (y < surface(b.x) || y > H) continue
        ctx.beginPath()
        ctx.arc(b.x + Math.sin(t * 4 + b.r) * 4, y, b.r, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    draw(-30, 0)
    if (!active) return
    const t0 = performance.now()
    let raf
    const loop = now => {
      const t = (now - t0) / 1000
      const k = Math.min(1, t / 1.5)
      const ease = k * k * (3 - 2 * k)
      draw(-30 + (H + 60) * ease, t)
      if (k < 1) raf = requestAnimationFrame(loop)
      else canvas.style.display = 'none'
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [active])

  return (
    <>
      <DefaultIntro category={category} active={active} />
      <canvas ref={ref} className="tx-overlay" aria-hidden="true" />
    </>
  )
}
