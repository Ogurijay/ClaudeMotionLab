import { useEffect, useRef, useState } from 'react'
import Section from './Section.jsx'
import { transitions } from './transitions'
import { effectsByCategory } from './registry.js'

/** Default chapter intro: the title wipes in with the chapter's accent line. */
function DefaultTransition({ category, active }) {
  return (
    <div className={`chapter__intro ${active ? 'is-in' : ''}`}>
      <span className="chapter__line" />
      <span className="chapter__prefix">{category.prefix}</span>
    </div>
  )
}

/**
 * One chapter of the long scroll: an intro transition, the chapter header,
 * live demos for finished effects, and "coming soon" cards for the rest.
 */
export default function Chapter({ category }) {
  const ref = useRef(null)
  const [active, setActive] = useState(false)
  const list = effectsByCategory(category.id)
  const done = list.filter(e => e.status === 'done')
  const upcoming = list.filter(e => e.status !== 'done')
  const Transition = transitions[category.id] ?? DefaultTransition

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setActive(true) }, { threshold: 0.35 })
    io.observe(ref.current)
    return () => io.disconnect()
  }, [])

  return (
    <div className="chapter" id={`chapter-${category.id}`} style={{ '--accent': category.accent }}>
      <header className="chapter__head" ref={ref}>
        <Transition category={category} active={active} />
        <h2 className={`chapter__title ${active ? 'is-in' : ''}`}>
          <span>{category.title}</span>
          <small>{category.subtitle}</small>
        </h2>
        <p className="chapter__desc">{category.desc}</p>
        <p className="chapter__count">{done.length} / {list.length} 已完成</p>
      </header>

      {done.map(effect => <Section key={effect.id} effect={effect} />)}

      {upcoming.length > 0 && (
        <div className="upcoming">
          <h3 className="upcoming__title">即将推出</h3>
          <div className="upcoming__grid">
            {upcoming.map(e => (
              <article key={e.id} className="upcoming__card" id={e.id}>
                <div className="upcoming__meta">
                  <span>{e.id}</span>
                  <span className={`upcoming__wave w${e.wave}`}>{e.wave === 1 ? '首发' : '扩充'}</span>
                </div>
                <h4>{e.name}</h4>
                <p>{e.desc}</p>
                <div className="upcoming__tags">{e.tags.map(t => <span key={t}>{t}</span>)}</div>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
