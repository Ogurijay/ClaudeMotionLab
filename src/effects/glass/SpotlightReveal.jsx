import { useEffect, useRef } from 'react'
import './SpotlightReveal.css'

// constellation drawn on the hidden layer
const STARS = [[12, 22], [20, 30], [28, 24], [36, 34], [30, 44], [18, 46], [64, 18], [72, 26], [80, 20], [76, 36], [86, 42]]
const LINKS = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 1], [6, 7], [7, 8], [7, 9], [9, 10]]
const BASE = 170   // beam radius baked into the shade gradient; other sizes are reached by scaling

/**
 * A dark room explored with a flashlight: a soft-edged beam follows the cursor
 * (with a little lag and flicker) and reveals a hidden layer — notes,
 * constellations and a message. Click to widen or narrow the beam.
 *
 * The darkness is one oversized layer with a hole in the middle, moved and scaled
 * purely with transforms, so the beam never triggers a repaint.
 */
export default function SpotlightReveal({ radius = 170 }) {
  const ref = useRef(null)
  const shadeRef = useRef(null)
  const glowRef = useRef(null)

  useEffect(() => {
    const el = ref.current, shade = shadeRef.current, glow = glowRef.current
    const s = { x: 0, y: 0, tx: 0, ty: 0, r: radius, tr: radius, inside: false, w: 1, h: 1 }
    const size = () => { const r = el.getBoundingClientRect(); s.w = r.width; s.h = r.height }
    size()
    s.x = s.tx = s.w / 2; s.y = s.ty = s.h / 2
    const ro = new ResizeObserver(size)
    ro.observe(el)
    const onMove = e => {
      const r = el.getBoundingClientRect()
      s.tx = e.clientX - r.left; s.ty = e.clientY - r.top; s.inside = true
    }
    const onLeave = () => { s.inside = false }
    const onClick = () => { s.tr = s.tr > radius ? radius : radius * 1.7 }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerleave', onLeave)
    el.addEventListener('click', onClick)

    let raf = 0, onScreen = false
    const io = new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting
      if (onScreen && !raf) raf = requestAnimationFrame(tick)
    })
    io.observe(el)
    const t0 = performance.now()
    function tick() {
      if (!onScreen) { raf = 0; return }
      const t = (performance.now() - t0) / 1000
      if (!s.inside) { s.tx = s.w * (0.5 + Math.sin(t * 0.6) * 0.32); s.ty = s.h * (0.5 + Math.sin(t * 0.9 + 1) * 0.25) }
      s.x += (s.tx - s.x) * 0.12
      s.y += (s.ty - s.y) * 0.12
      s.r += (s.tr - s.r) * 0.12
      const k = (s.r / BASE) * (0.985 + Math.random() * 0.015)   // slight flicker
      const move = `translate3d(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px, 0) scale(${k.toFixed(4)})`
      shade.style.transform = move
      glow.style.transform = move
      raf = requestAnimationFrame(tick)
    }
    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      ro.disconnect()
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
      el.removeEventListener('click', onClick)
    }
  }, [radius])

  return (
    <div className="spot" ref={ref}>
      <div className="spot__layer">
        <svg className="spot__sky" viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true">
          {LINKS.map(([a, b], i) => <line key={i} x1={STARS[a][0]} y1={STARS[a][1]} x2={STARS[b][0]} y2={STARS[b][1]} />)}
          {STARS.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 3 ? 0.6 : 1} />)}
        </svg>
        <h3 className="spot__title">LOOK CLOSER</h3>
        <p className="spot__note spot__note--a">the key is under the third tile</p>
        <p className="spot__note spot__note--b">GL-04 · 23:41 · lights out</p>
        <p className="spot__note spot__note--c">← this way</p>
        <span className="spot__badge">✦ found it</span>
      </div>
      <div className="spot__glow" ref={glowRef} />
      <div className="spot__shade" ref={shadeRef} />
    </div>
  )
}
