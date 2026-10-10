import { useEffect, useRef } from 'react'
import DefaultIntro from './DefaultIntro.jsx'

const COLORS = ['#facc15', '#eab308', '#a16207', '#422006', '#1c1917']

/** Pixel chapter intro: a wall of pixel blocks covers the header, then dissolves block by block. */
export default function PixelTransition({ category, active }) {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas.getContext('2d')
    const r = canvas.getBoundingClientRect()
    const size = 22
    const cols = Math.ceil(r.width / size), rows = Math.ceil(r.height / size)
    canvas.width = cols * size
    canvas.height = rows * size
    // each block gets a dissolve time: a left-to-right sweep plus jitter
    const blocks = Array.from({ length: cols * rows }, (_, i) => {
      const x = i % cols
      return { x, y: (i / cols) | 0, t: (x / cols) * 700 + Math.random() * 600, c: COLORS[(Math.random() * COLORS.length) | 0] }
    })
    const draw = elapsed => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (const b of blocks) {
        if (elapsed > b.t) continue
        ctx.fillStyle = elapsed > b.t - 90 ? '#fff' : b.c   // flash white just before vanishing
        ctx.fillRect(b.x * size, b.y * size, size - 2, size - 2)
      }
    }
    draw(0)
    if (!active) return
    const t0 = performance.now()
    let raf
    const loop = now => {
      const e = now - t0
      draw(e)
      if (e < 1400) raf = requestAnimationFrame(loop)
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
