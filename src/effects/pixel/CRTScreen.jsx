import { useEffect, useId, useRef, useState } from 'react'
import './CRTScreen.css'

// Barrel-distortion displacement map for feDisplacementMap: R/G encode the x/y offset
// (0.5 = none). Sampling the source further out than the output pixel bulges the
// image like a convex tube and pushes the corners out of frame.
function makeBarrelMap(w, h, k, scale) {
  const mw = Math.max(2, Math.round(w / 3)), mh = Math.max(2, Math.round(h / 3))
  const c = document.createElement('canvas')
  c.width = mw; c.height = mh
  const ctx = c.getContext('2d')
  const img = ctx.createImageData(mw, mh)
  for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
    const u = (x / (mw - 1)) * 2 - 1, v = (y / (mh - 1)) * 2 - 1
    const r2 = u * u + v * v
    const dx = u * k * r2 * (w / 2), dy = v * k * r2 * (h / 2)
    const i = (y * mw + x) * 4
    img.data[i] = Math.max(0, Math.min(255, (0.5 + dx / scale) * 255))
    img.data[i + 1] = Math.max(0, Math.min(255, (0.5 + dy / scale) * 255))
    img.data[i + 2] = 128
    img.data[i + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  return c.toDataURL()
}

/**
 * Wraps any content in a cathode-ray tube: real barrel distortion and chromatic
 * aberration (SVG filter on live DOM), scanlines, shadow mask, flicker, and a
 * power switch with the classic collapse-to-a-dot animation.
 * With no children it shows an interactive retro terminal.
 */
export default function CRTScreen({ children, curvature = 0.1, aberration = 2, phosphor = 'green' }) {
  const id = useId().replace(/:/g, '')
  const screenRef = useRef(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [on, setOn] = useState(true)
  const [map, setMap] = useState('')
  const scale = Math.max(1, curvature * Math.max(size.w, size.h) * 1.2)

  useEffect(() => {
    const el = screenRef.current
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect
      setSize({ w: Math.round(width), h: Math.round(height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!size.w || !size.h) return
    setMap(makeBarrelMap(size.w, size.h, curvature, scale))
  }, [size.w, size.h, curvature, scale])

  const channel = (sc, m, name) => (
    <>
      <feDisplacementMap in="SourceGraphic" in2="map" scale={sc} xChannelSelector="R" yChannelSelector="G" result={`d${name}`} />
      <feColorMatrix in={`d${name}`} type="matrix" values={m} result={name} />
    </>
  )

  return (
    <div className={`crt crt--${phosphor} ${on ? 'is-on' : 'is-off'}`}>
      <svg className="crt__defs" aria-hidden="true">
        <filter id={id} x="0" y="0" width={size.w} height={size.h} filterUnits="userSpaceOnUse"
          primitiveUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          {map && <feImage href={map} x="0" y="0" width={size.w} height={size.h} preserveAspectRatio="none" result="map" />}
          {channel(scale, '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0', 'r')}
          {channel(scale + aberration, '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0', 'g')}
          {channel(scale + aberration * 2, '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0', 'b')}
          <feBlend in="r" in2="g" mode="screen" result="rg" />
          <feBlend in="rg" in2="b" mode="screen" />
        </filter>
      </svg>

      <div className="crt__bezel">
        <div className="crt__screen" ref={screenRef} style={{ filter: map ? `url(#${id})` : 'none' }}>
          <div className="crt__tube">
            <div className="crt__content">{children ?? <Terminal powered={on} />}</div>
            <div className="crt__scanlines" />
            <div className="crt__mask" />
            <div className="crt__roll" />
          </div>
        </div>
        <div className="crt__glass" />
      </div>

      <div className="crt__panel">
        <span className="crt__brand">CML-1987</span>
        <span className="crt__led" />
        <button className="crt__power" onClick={() => setOn(v => !v)} aria-pressed={on}>POWER</button>
      </div>
    </div>
  )
}

const BOOT = [
  'CLAUDE MOTION LAB BIOS v0.3',
  'MEMORY TEST ........... 640K OK',
  'VIDEO ................. CRT 80x25',
  'LOADING CHAPTER: PIXEL',
  '',
  '  ██████ ██   ██ ██',
  '  ██     ███ ███ ██',
  '  ██     ██ █ ██ ██',
  '  ██████ ██   ██ ██████',
  '',
  'Type "help" and press Enter.',
]

const COMMANDS = {
  help: () => ['commands: help  about  date  color  matrix  clear'],
  about: () => ['CRTScreen: barrel distortion + chromatic aberration', 'are an SVG filter applied to live DOM.'],
  date: () => [new Date().toString().slice(0, 24)],
  matrix: () => Array.from({ length: 6 }, () => Array.from({ length: 34 }, () => (Math.random() < 0.5 ? '0' : '1')).join('')),
}

/** Tiny interactive terminal used as the default CRT content. */
function Terminal({ powered }) {
  const [lines, setLines] = useState([])
  const [input, setInput] = useState('')
  const [color, setColor] = useState(0)
  const ref = useRef(null)

  // typewriter boot sequence, replayed every time the set powers on
  useEffect(() => {
    if (!powered) { setLines([]); return }
    let i = 0, timer
    const next = () => {
      setLines(BOOT.slice(0, ++i))
      if (i < BOOT.length) timer = setTimeout(next, BOOT[i - 1] === '' ? 120 : 220)
    }
    timer = setTimeout(next, 600)
    return () => clearTimeout(timer)
  }, [powered])

  useEffect(() => { ref.current?.scrollTo(0, ref.current.scrollHeight) }, [lines])

  const run = cmd => {
    const c = cmd.trim().toLowerCase()
    if (c === 'clear') return setLines([])
    if (c === 'color') { setColor(v => (v + 1) % 3); return setLines(l => [...l, `> ${cmd}`, 'phosphor changed']) }
    const out = COMMANDS[c]?.() ?? (c ? [`unknown command: ${c}`] : [])
    setLines(l => [...l, `> ${cmd}`, ...out].slice(-40))
  }

  const onKeyDown = e => {
    if (e.key === 'Enter') { run(input); setInput(''); e.preventDefault() }
    else if (e.key === 'Backspace') { setInput(v => v.slice(0, -1)); e.preventDefault() }
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) { setInput(v => (v + e.key).slice(0, 40)); e.preventDefault() }
  }

  return (
    <div className={`term term--c${color}`} tabIndex={0} onKeyDown={onKeyDown} ref={ref}
      onPointerDown={e => e.currentTarget.focus()}>
      {lines.map((l, i) => <div key={i} className="term__line">{l || ' '}</div>)}
      {powered && lines.length >= BOOT.length - 1 && (
        <div className="term__line">&gt; {input}<span className="term__cursor">█</span></div>
      )}
    </div>
  )
}
