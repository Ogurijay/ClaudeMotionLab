import { useEffect, useRef } from 'react'
import './HoloCard.css'

/**
 * Holographic trading card: spring-smoothed 3D tilt, rainbow foil that slides
 * with the cursor, sparkle layer, glare, and parallax content layers.
 */
export default function HoloCard({ title, subtitle, number, hue = 260, emblem = 'rings' }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    const s = { x: 0.5, y: 0.5, a: 0, tx: 0.5, ty: 0.5, ta: 0, vx: 0, vy: 0 }
    let raf = 0
    const wake = () => { if (!raf) raf = requestAnimationFrame(tick) }
    const onMove = e => {
      const r = el.getBoundingClientRect()
      s.tx = (e.clientX - r.left) / r.width
      s.ty = (e.clientY - r.top) / r.height
      s.ta = 1
      wake()
    }
    const onLeave = () => { s.tx = 0.5; s.ty = 0.5; s.ta = 0; wake() }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerleave', onLeave)

    function tick() {
      // critically-damped-ish spring for a weighty, physical feel
      s.vx = (s.vx + (s.tx - s.x) * 0.08) * 0.78
      s.vy = (s.vy + (s.ty - s.y) * 0.08) * 0.78
      s.x += s.vx
      s.y += s.vy
      s.a += (s.ta - s.a) * 0.08
      el.style.setProperty('--mx', s.x.toFixed(4))
      el.style.setProperty('--my', s.y.toFixed(4))
      el.style.setProperty('--active', s.a.toFixed(4))
      // sleep once the spring has settled; pointer events wake it again
      const moving = Math.abs(s.tx - s.x) + Math.abs(s.ty - s.y) + Math.abs(s.vx) + Math.abs(s.vy) + Math.abs(s.ta - s.a) > 0.0005
      raf = moving ? requestAnimationFrame(tick) : 0
    }
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  return (
    <div className="holo" ref={ref} style={{ '--hue': hue }}>
      <div className="holo__body">
        <div className="holo__layer holo__art" />
        <div className="holo__layer holo__grid" />
        <div className="holo__layer holo__foil" />
        <div className="holo__layer holo__sparkle" />
        <div className="holo__layer holo__glare" />
        <div className="holo__emblem"><Emblem kind={emblem} /></div>
        <div className="holo__content">
          <span className="holo__num">No. {number}</span>
          <div>
            <h3 className="holo__title">{title}</h3>
            <p className="holo__sub">{subtitle}</p>
          </div>
        </div>
        <div className="holo__edge" />
      </div>
    </div>
  )
}

function Emblem({ kind }) {
  if (kind === 'rings') {
    return (
      <svg viewBox="0 0 200 200">
        {[30, 48, 66, 84].map((r, i) => (
          <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="white" strokeOpacity={0.9 - i * 0.18} strokeWidth="2" strokeDasharray={i % 2 ? '4 6' : 'none'} />
        ))}
        <circle cx="100" cy="100" r="12" fill="white" />
      </svg>
    )
  }
  if (kind === 'prism') {
    return (
      <svg viewBox="0 0 200 200">
        <polygon points="100,20 180,160 20,160" fill="none" stroke="white" strokeWidth="2.5" />
        <polygon points="100,62 144,138 56,138" fill="white" fillOpacity="0.18" stroke="white" strokeWidth="1.5" />
        <line x1="100" y1="20" x2="100" y2="160" stroke="white" strokeOpacity="0.5" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 200 200">
      {Array.from({ length: 12 }, (_, i) => (
        <ellipse key={i} cx="100" cy="100" rx="80" ry="22" fill="none" stroke="white" strokeOpacity="0.55" strokeWidth="1.5" transform={`rotate(${i * 15} 100 100)`} />
      ))}
      <circle cx="100" cy="100" r="8" fill="white" />
    </svg>
  )
}
