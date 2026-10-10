import { useEffect, useRef } from 'react'
import DefaultIntro from './DefaultIntro.jsx'

/** Cyber chapter intro: the header flickers through a burst of RGB-split interference bars before locking in. */
export default function CyberTransition({ category, active }) {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas.getContext('2d')
    const r = canvas.getBoundingClientRect()
    canvas.width = r.width
    canvas.height = r.height
    const W = r.width, H = r.height
    const draw = k => {
      ctx.clearRect(0, 0, W, H)
      ctx.fillStyle = `rgba(7,7,11,${1 - k})`
      ctx.fillRect(0, 0, W, H)
      const bars = Math.round(18 * (1 - k)) + 2
      for (let i = 0; i < bars; i++) {
        const y = Math.random() * H, h = 2 + Math.random() * 18, x = Math.random() * W * 0.3
        ctx.fillStyle = ['rgba(0,240,255,0.7)', 'rgba(255,0,170,0.7)', 'rgba(124,92,255,0.8)'][i % 3]
        ctx.fillRect(x, y, W * (0.3 + Math.random() * 0.7), h)
      }
    }
    draw(0)
    if (!active) return
    const t0 = performance.now()
    let raf
    const loop = now => {
      const k = Math.min(1, (now - t0) / 900)
      draw(k)
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
