import { useId, useState } from 'react'
import './GooeyMenu.css'

const ICONS = {
  home: 'M4 11l8-7 8 7v9h-5v-6H9v6H4z',
  search: 'M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zm0 2a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zM15 15.6l1.4-1.4 4.2 4.2-1.4 1.4z',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  camera: 'M4 8h3l2-2h6l2 2h3v11H4zm8 2.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
  bell: 'M12 3a6 6 0 0 1 6 6v4l2 3H4l2-3V9a6 6 0 0 1 6-6zm-2 15h4a2 2 0 0 1-4 0z',
  gear: 'M10.6 3h2.8l.5 2.3 1.7.9 2.2-.9 1.4 2.4-1.7 1.6v1.4l1.7 1.6-1.4 2.4-2.2-.9-1.7.9-.5 2.3h-2.8l-.5-2.3-1.7-.9-2.2.9-1.4-2.4 1.7-1.6v-1.4L4.8 7.7l1.4-2.4 2.2.9 1.7-.9zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
}

const Icon = ({ name }) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICONS[name]} /></svg>

/**
 * Liquid UI built on an SVG "goo" filter (blur + alpha threshold): a radial
 * action menu whose bubbles bud off the main button like mercury, and a tab bar
 * whose indicator stretches between tabs.
 */
export default function GooeyMenu({ items = ['home', 'search', 'heart', 'camera', 'bell', 'gear'], color = '#38bdf8', radius = 120 }) {
  const id = useId().replace(/:/g, '')
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState(null)
  const [tab, setTab] = useState(0)
  const [prevTab, setPrevTab] = useState(0)

  // fan the bubbles over the upper half-circle
  const pos = items.map((_, i) => {
    const a = Math.PI + (Math.PI * (i + 0.5)) / items.length
    return [Math.cos(a) * radius, Math.sin(a) * radius]
  })
  const xform = (i, scale = 1) => {
    const [x, y] = open ? pos[i] : [0, 0]
    return { transform: `translate(${x}px, ${y}px) scale(${open ? scale : 0.6})`, transitionDelay: `${(open ? i : items.length - i) * 35}ms` }
  }
  const tabs = items.slice(0, 5)
  const forward = tab >= prevTab

  return (
    <div className="goo" style={{ '--goo': color }}>
      <svg className="goo__defs" aria-hidden="true">
        <filter id={id}>
          <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
          <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10" result="goo" />
          <feComposite in="SourceGraphic" in2="goo" operator="atop" />
        </filter>
      </svg>

      {/* radial menu: blobs under the goo filter, crisp icons on top */}
      <div className="goo__radial">
        <div className="goo__layer" style={{ filter: `url(#${id})` }}>
          {items.map((it, i) => <span key={it} className="goo__blob" style={xform(i)} />)}
          <span className={`goo__blob goo__blob--main ${open ? 'is-open' : ''}`} />
        </div>
        <div className="goo__layer">
          {items.map((it, i) => (
            <button key={it} className="goo__item" style={xform(i)} tabIndex={open ? 0 : -1}
              onClick={() => { setPicked(it); setOpen(false) }} aria-label={it}>
              <Icon name={it} />
            </button>
          ))}
          <button className={`goo__main ${open ? 'is-open' : ''}`} onClick={() => setOpen(o => !o)} aria-expanded={open} aria-label="menu">
            <span /><span />
          </button>
        </div>
        <p className="goo__picked">{picked ? `selected · ${picked}` : 'tap the button'}</p>
      </div>

      {/* tab bar: two indicator blobs with staggered timing stretch into one liquid drop */}
      <div className="goo__tabs">
        <div className="goo__layer" style={{ filter: `url(#${id})` }}>
          <span className="goo__bar" />
          <span className="goo__ind" style={{ left: `calc(${tab} * 20% + 10%)`, transitionDelay: forward ? '0ms' : '90ms' }} />
          <span className="goo__ind" style={{ left: `calc(${tab} * 20% + 10%)`, transitionDelay: forward ? '90ms' : '0ms' }} />
        </div>
        <div className="goo__layer goo__tabrow">
          {tabs.map((it, i) => (
            <button key={it} className={i === tab ? 'is-active' : ''} onClick={() => { setPrevTab(tab); setTab(i) }} aria-label={it}>
              <Icon name={it} />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
