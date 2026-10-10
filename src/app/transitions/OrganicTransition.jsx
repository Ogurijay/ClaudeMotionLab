import { useEffect, useRef } from 'react'
import DefaultIntro from './DefaultIntro.jsx'

/** Organic chapter intro: vines sprout from the bottom edge, curl upward with leaves, then fade. */
export default function OrganicTransition({ category, active }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!active) return
    const canvas = ref.current
    const ctx = canvas.getContext('2d')
    const r = canvas.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio, 2)
    const W = r.width, H = r.height
    canvas.width = W * dpr
    canvas.height = H * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const stems = Array.from({ length: Math.round(W / 22) }, () => ({
      x: Math.random() * W,
      h: H * (0.35 + Math.random() * 0.75),
      sway: (Math.random() - 0.5) * 160,
      delay: Math.random() * 0.35,
      hue: 80 + Math.random() * 40,
    }))
    const pt = (s, t) => {
      // quadratic curve from the root, bending sideways as it rises
      const cx = s.x + s.sway * 0.2, cy = H - s.h * 0.55
      const ex = s.x + s.sway, ey = H - s.h
      const u = 1 - t
      return [u * u * s.x + 2 * u * t * cx + t * t * ex, u * u * H + 2 * u * t * cy + t * t * ey]
    }
    const t0 = performance.now()
    let raf
    const loop = now => {
      const e = (now - t0) / 1000
      ctx.clearRect(0, 0, W, H)
      const fade = 1 - Math.max(0, Math.min(1, (e - 1.2) / 0.6))
      for (const s of stems) {
        const g = Math.max(0, Math.min(1, (e - s.delay) / 1.0))
        if (g <= 0) continue
        const grow = 1 - Math.pow(1 - g, 3)
        ctx.strokeStyle = `hsla(${s.hue}, 70%, 45%, ${0.8 * fade})`
        ctx.lineWidth = 2
        ctx.beginPath()
        for (let k = 0; k <= 24; k++) {
          const [x, y] = pt(s, (k / 24) * grow)
          k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
        }
        ctx.stroke()
        ctx.fillStyle = `hsla(${s.hue + 10}, 75%, 55%, ${0.85 * fade})`
        for (let k = 1; k <= 5; k++) {
          const t = k / 6
          if (t > grow) break
          const [x, y] = pt(s, t)
          ctx.beginPath()
          ctx.ellipse(x + (k % 2 ? 7 : -7), y, 7 * Math.min(1, (grow - t) * 5), 3, k % 2 ? -0.6 : 0.6, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      if (e < 1.8) raf = requestAnimationFrame(loop)
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
