import { useEffect, useRef, useState } from 'react'
import './SpotlightReveal.css'

// constellation drawn on the hidden layer
const STARS = [[12, 22], [20, 30], [28, 24], [36, 34], [30, 44], [18, 46], [64, 18], [72, 26], [80, 20], [76, 36], [86, 42]]
const LINKS = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 1], [6, 7], [7, 8], [7, 9], [9, 10]]

/**
 * A dark room explored with a flashlight: a soft-edged beam follows the cursor
 * (with a little lag and flicker) and reveals a hidden layer — notes,
 * constellations and a message — under a faint decoy. Click to widen or
 * narrow the beam.
 */
export default function SpotlightReveal({ radius = 170 }) {
  const ref = useRef(null)
  const [wide, setWide] = useState(false)

  useEffect(() => {
    const el = ref.current
    const s = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, inside: false }
    const onMove = e => {
      const r = el.getBoundingClientRect()
      s.tx = (e.clientX - r.left) / r.width; s.ty = (e.clientY - r.top) / r.height; s.inside = true
    }
    const onLeave = () => { s.inside = false }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerleave', onLeave)
    let raf
    const t0 = performance.now()
    const tick = () => {
      const t = (performance.now() - t0) / 1000
      if (!s.inside) { s.tx = 0.5 + Math.sin(t * 0.6) * 0.32; s.ty = 0.5 + Math.sin(t * 0.9 + 1) * 0.25 }
      s.x += (s.tx - s.x) * 0.12
      s.y += (s.ty - s.y) * 0.12
      el.style.setProperty('--x', `${(s.x * 100).toFixed(2)}%`)
      el.style.setProperty('--y', `${(s.y * 100).toFixed(2)}%`)
      el.style.setProperty('--flicker', (0.97 + Math.random() * 0.03).toFixed(3))
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  const layer = hidden => (
    <div className={`spot__layer ${hidden ? 'spot__hidden' : 'spot__decoy'}`}>
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
  )

  return (
    <div className="spot" ref={ref} style={{ '--r': `${wide ? radius * 1.7 : radius}px` }} onClick={() => setWide(w => !w)}>
      {layer(false)}
      {layer(true)}
      <div className="spot__glow" />
    </div>
  )
}
