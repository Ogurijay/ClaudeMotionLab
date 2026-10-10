import { useEffect, useRef, useState } from 'react'
import './ScribbleUnderline.css'

// small seeded PRNG so a given seed always draws the same "hand"
function rng(seed) {
  let s = seed * 9301 + 49297
  return () => ((s = (s * 9301 + 49297) % 233280) / 233280)
}

// rough paths for each annotation style, in the text's own pixel box (w × h)
function scribblePath(variant, w, h, seed) {
  const r = rng(seed)
  const j = (amt) => (r() - 0.5) * amt
  const pad = 6
  switch (variant) {
    case 'circle': {
      const cx = w / 2, cy = h / 2, rx = w / 2 + 12, ry = h / 2 + 8
      const start = -2.4 + j(0.6), turns = 1.12 + r() * 0.12
      const pts = []
      for (let i = 0; i <= 40; i++) {
        const a = start + (i / 40) * Math.PI * 2 * turns
        const k = 1 + j(0.08) + (i / 40) * 0.06
        pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k])
      }
      return 'M' + pts.map(p => p.map(v => v.toFixed(1)).join(' ')).join(' L')
    }
    case 'highlight': {
      let d = ''
      for (let k = 0; k < 3; k++) {
        const y = h * (0.35 + k * 0.15) + j(3)
        d += `M${-4 + j(4)} ${y} C ${w * 0.3} ${y + j(5)}, ${w * 0.7} ${y + j(5)}, ${w + 4 + j(4)} ${y + j(3)} `
      }
      return d
    }
    case 'strike': {
      const y = h * 0.55
      return `M${-4} ${y + j(4)} C ${w * 0.35} ${y + j(6)}, ${w * 0.65} ${y + j(6)}, ${w + 4} ${y + j(4)} ` +
        `M${w * 0.05} ${y + 5 + j(3)} C ${w * 0.4} ${y + j(6)}, ${w * 0.7} ${y + j(6)}, ${w * 0.98} ${y - 4 + j(3)}`
    }
    case 'box': {
      const x0 = -pad + j(4), y0 = -pad + j(4), x1 = w + pad + j(4), y1 = h + pad + j(4)
      return `M${x0} ${y0 + 3} L${x1 + j(3)} ${y0 + j(3)} L${x1} ${y1 + j(3)} L${x0 + j(3)} ${y1} L${x0 + j(2)} ${y0 - 2} L${x0 + 14} ${y0 + j(2)}`
    }
    default: { // underline: a quick wavy double stroke
      const y = h + 3
      return `M${-2 + j(3)} ${y + j(2)} C ${w * 0.3} ${y + 4 + j(3)}, ${w * 0.6} ${y - 3 + j(3)}, ${w + 4} ${y + 1 + j(2)} ` +
        `M${w * 0.08} ${y + 6 + j(2)} C ${w * 0.4} ${y + 9 + j(3)}, ${w * 0.75} ${y + 3 + j(3)}, ${w * 0.95} ${y + 6 + j(2)}`
    }
  }
}

/**
 * Hand-drawn annotation around inline text — underline, circle, highlight,
 * strike-through or box. Draws itself stroke by stroke when scrolled into view
 * and re-scribbles with a fresh hand on hover.
 */
export default function ScribbleUnderline({ children = 'scribble', variant = 'underline', color = '#e11d48', strokeWidth = 3, duration = 800 }) {
  const ref = useRef(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  const [seed, setSeed] = useState(() => (Math.random() * 1000) | 0)
  const [drawn, setDrawn] = useState(false)

  useEffect(() => {
    const el = ref.current
    const ro = new ResizeObserver(() => setBox({ w: el.offsetWidth, h: el.offsetHeight }))
    ro.observe(el)
    const io = new IntersectionObserver(([e]) => setDrawn(e.isIntersecting), { threshold: 0.8 })
    io.observe(el)
    return () => { ro.disconnect(); io.disconnect() }
  }, [])

  const redraw = () => {
    setDrawn(false)
    setSeed(s => s + 7)
    requestAnimationFrame(() => requestAnimationFrame(() => setDrawn(true)))
  }

  const m = 20 // svg overflow margin around the text box
  const isHighlight = variant === 'highlight'
  return (
    <span ref={ref} className={`scrib scrib--${variant}`} onPointerEnter={redraw}>
      {box.w > 0 && (
        <svg className="scrib__svg" width={box.w + m * 2} height={box.h + m * 2} viewBox={`${-m} ${-m} ${box.w + m * 2} ${box.h + m * 2}`} aria-hidden="true">
          <path
            d={scribblePath(variant, box.w, box.h, seed)}
            pathLength="1"
            fill="none"
            stroke={color}
            strokeWidth={isHighlight ? Math.max(10, box.h * 0.32) : strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: 1,
              strokeDashoffset: drawn ? 0 : 1,
              opacity: isHighlight ? 0.35 : 0.9,
              transition: drawn ? `stroke-dashoffset ${duration}ms cubic-bezier(0.6, 0, 0.3, 1)` : 'none',
            }}
          />
        </svg>
      )}
      <span className="scrib__text">{children}</span>
    </span>
  )
}
