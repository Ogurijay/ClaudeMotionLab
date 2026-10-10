import { useEffect, useRef, useState } from 'react'
import './OrigamiFold.css'

/** Default content: a small invitation card. */
function Invitation() {
  return (
    <div className="ori-card">
      <span className="ori-card__kicker">CLAUDE MOTION LAB</span>
      <h3 className="ori-card__title">You’re invited</h3>
      <svg className="ori-card__sun" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="18" />
        {Array.from({ length: 12 }, (_, i) => (
          <line key={i} x1="50" y1="14" x2="50" y2="24" transform={`rotate(${i * 30} 50 50)`} />
        ))}
      </svg>
      <p className="ori-card__line">An evening of paper, ink &amp; motion.</p>
      <dl className="ori-card__meta">
        <div><dt>When</dt><dd>Fri · 19:30</dd></div>
        <div><dt>Where</dt><dd>Studio 7, Paper Lane</dd></div>
        <div><dt>RSVP</dt><dd>hello@motion.lab</dd></div>
      </dl>
      <p className="ori-card__sign">— fold, unfold, repeat —</p>
    </div>
  )
}

/**
 * Content that folds up like a letter: it is cut into horizontal panels that
 * hinge on each other and flip up one after another, the deepest first.
 * Opens when scrolled into view; click to fold / unfold.
 */
export default function OrigamiFold({ children, panels = 4, height = 440, width = 340, duration = 700 }) {
  const ref = useRef(null)
  const [open, setOpen] = useState(false)
  const ph = height / panels

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setTimeout(() => setOpen(true), 400) }, { threshold: 0.6 })
    io.observe(ref.current)
    return () => io.disconnect()
  }, [])

  // panels are nested so each one hinges on the bottom edge of its parent
  const panel = i => {
    // unfold from the top down, fold from the bottom up
    const delay = open ? (i - 1) * duration * 0.55 : (panels - 1 - i) * duration * 0.55
    return (
      <div className="ori__panel" style={{
        height: ph,
        top: i === 0 ? 0 : '100%',
        transform: i === 0 || open ? 'rotateX(0deg)' : 'rotateX(179.5deg)',
        transitionDuration: `${duration}ms`,
        transitionDelay: `${Math.max(0, delay)}ms`,
      }}>
        <div className="ori__face ori__front">
          <div className="ori__content" style={{ height, transform: `translateY(${-i * ph}px)` }}>{children ?? <Invitation />}</div>
          <span className="ori__shade" style={{ opacity: open ? 0 : 0.5, transitionDelay: `${Math.max(0, delay)}ms`, transitionDuration: `${duration}ms` }} />
        </div>
        <div className="ori__face ori__back" />
        {i < panels - 1 && panel(i + 1)}
      </div>
    )
  }

  return (
    <div className="ori" ref={ref} onClick={() => setOpen(o => !o)} style={{ width, height }} role="button" aria-pressed={open} tabIndex={0}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setOpen(o => !o)}>
      {panel(0)}
    </div>
  )
}
