import { useEffect, useRef } from 'react'
import { useVisibility } from '../../hooks/useVisibility'

/**
 * Variable-font proximity type. Each letter is a spring: it fattens, glows and
 * is pushed away as the cursor approaches, and skews with cursor velocity.
 * With no cursor, a weight wave rolls through the line.
 */
export default function KineticType({ text = 'MAKE IT MOVE', radius = 340, minWeight = 100, maxWeight = 900 }) {
  const wrapRef = useRef(null)
  const visible = useVisibility(wrapRef)

  useEffect(() => {
    const wrap = wrapRef.current
    const letters = [...wrap.querySelectorAll('.kt__char')]
    const st = letters.map(() => ({ x: 0, y: 0, vx: 0, vy: 0, w: minWeight, s: 0 }))
    const ptr = { x: -9999, y: -9999, px: -9999, vx: 0, inside: false }

    // letter centres relative to the wrapper, measured only on resize / font load —
    // reading layout inside the animation loop would force a synchronous reflow every frame
    let centers = []
    const measure = () => {
      centers = letters.map(el => [el.offsetLeft + el.offsetWidth / 2, el.offsetTop + el.offsetHeight / 2])
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(wrap)
    document.fonts?.ready.then(measure)
    let base = wrap.getBoundingClientRect()
    const onScroll = () => { base = null }
    window.addEventListener('scroll', onScroll, { passive: true })

    const onMove = e => {
      base ??= wrap.getBoundingClientRect()
      ptr.x = e.clientX - base.left
      ptr.y = e.clientY - base.top
      ptr.inside = true
    }
    const onLeave = () => { ptr.inside = false }
    wrap.addEventListener('pointermove', onMove)
    wrap.addEventListener('pointerleave', onLeave)

    let raf
    const t0 = performance.now()
    const tick = () => {
      raf = requestAnimationFrame(tick)
      if (!visible.current) return
      const t = (performance.now() - t0) / 1000
      ptr.vx += ((ptr.x - (ptr.px === -9999 ? ptr.x : ptr.px)) - ptr.vx) * 0.2
      ptr.px = ptr.x

      letters.forEach((el, i) => {
        const s = st[i]
        let fall, dx = 0, dy = 0
        if (ptr.inside) {
          dx = centers[i][0] - ptr.x
          dy = centers[i][1] - ptr.y
          const d = Math.hypot(dx, dy)
          fall = Math.max(0, 1 - d / radius)
          fall = fall * fall * (3 - 2 * fall)
          const inv = 1 / (d + 1e-3)
          dx *= inv
          dy *= inv
        } else {
          fall = (Math.sin(t * 2.4 - i * 0.6) * 0.5 + 0.5) ** 4
        }
        const tw = minWeight + (maxWeight - minWeight) * fall
        const tx = dx * fall * 48
        const ty = dy * fall * 48 - (ptr.inside ? 0 : fall * 10)
        s.vx = (s.vx + (tx - s.x) * 0.14) * 0.72
        s.vy = (s.vy + (ty - s.y) * 0.14) * 0.72
        s.x += s.vx
        s.y += s.vy
        s.w += (tw - s.w) * 0.16
        s.s += ((ptr.inside ? Math.max(-1, Math.min(1, ptr.vx / 40)) * fall : 0) - s.s) * 0.12

        el.style.fontVariationSettings = `'wght' ${s.w.toFixed(0)}`
        el.style.transform = `translate(${s.x.toFixed(2)}px, ${s.y.toFixed(2)}px) skewX(${(-s.s * 18).toFixed(2)}deg)`
        el.style.setProperty('--glow', fall.toFixed(3))
      })
    }
    tick()
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('scroll', onScroll)
      wrap.removeEventListener('pointermove', onMove)
      wrap.removeEventListener('pointerleave', onLeave)
    }
  }, [text, radius, minWeight, maxWeight, visible])

  return (
    <div className="kt" ref={wrapRef} aria-label={text}>
      {text.split('').map((ch, i) => (
        <span key={i} className="kt__char" aria-hidden="true">{ch === ' ' ? ' ' : ch}</span>
      ))}
    </div>
  )
}
