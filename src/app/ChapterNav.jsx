import { useEffect, useState } from 'react'
import { categories, effectsByCategory } from './registry.js'

/** Fixed side navigation: chapter list with the current chapter highlighted and page progress. */
export default function ChapterNav() {
  const [active, setActive] = useState(null)
  const [progress, setProgress] = useState(0)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const els = categories.map(c => document.getElementById(`chapter-${c.id}`)).filter(Boolean)
    const io = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) setActive(e.target.id.replace('chapter-', ''))
    }, { rootMargin: '-45% 0px -45% 0px' })
    els.forEach(el => io.observe(el))

    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      setProgress(max > 0 ? window.scrollY / max : 0)
      setShown(window.scrollY > window.innerHeight * 0.6)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { io.disconnect(); window.removeEventListener('scroll', onScroll) }
  }, [])

  const go = id => document.getElementById(`chapter-${id}`)?.scrollIntoView({ behavior: 'smooth' })

  return (
    <nav className={`cnav ${shown ? 'is-shown' : ''}`} aria-label="Chapters">
      <div className="cnav__track"><div className="cnav__bar" style={{ transform: `scaleY(${progress})` }} /></div>
      <ul>
        {categories.map(c => {
          const list = effectsByCategory(c.id)
          const done = list.filter(e => e.status === 'done').length
          return (
            <li key={c.id}>
              <button className={active === c.id ? 'is-active' : ''} style={{ '--accent': c.accent }} onClick={() => go(c.id)}>
                <span className="cnav__label">{c.title}<small>{done}/{list.length}</small></span>
                <span className="cnav__prefix">{c.prefix}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
