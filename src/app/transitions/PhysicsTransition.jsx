import { useEffect, useRef } from 'react'
import DefaultIntro from './DefaultIntro.jsx'

/** Physics chapter intro: blocks drop in under gravity, bounce on the floor, settle, then fade away. */
export default function PhysicsTransition({ category, active }) {
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
    const colors = ['#fb7185', '#f43f5e', '#fda4af', '#ffe4e6']
    const blocks = Array.from({ length: 16 }, (_, i) => {
      const s = 26 + Math.random() * 46
      return { x: (i + 0.5) * (W / 16) - s / 2, y: -s - Math.random() * H * 0.8, s, vy: 0, rot: Math.random(), vr: (Math.random() - 0.5) * 6, c: colors[i % colors.length] }
    })
    const t0 = performance.now()
    let raf, last = t0
    const loop = now => {
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now
      const e = (now - t0) / 1000
      ctx.clearRect(0, 0, W, H)
      ctx.globalAlpha = 1 - Math.max(0, Math.min(1, (e - 1.5) / 0.5))
      for (const b of blocks) {
        b.vy += 2600 * dt
        b.y += b.vy * dt
        b.rot += b.vr * dt
        if (b.y + b.s > H) { b.y = H - b.s; b.vy *= -0.45; b.vr *= 0.6; b.rot *= 0.8 }
        ctx.save()
        ctx.translate(b.x + b.s / 2, b.y + b.s / 2)
        ctx.rotate(b.rot)
        ctx.fillStyle = b.c
        ctx.beginPath()
        ctx.roundRect(-b.s / 2, -b.s / 2, b.s, b.s, 8)
        ctx.fill()
        ctx.restore()
      }
      if (e < 2) raf = requestAnimationFrame(loop)
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
