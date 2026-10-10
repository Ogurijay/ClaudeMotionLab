import LazyMount from './LazyMount.jsx'
import EffectView from './EffectView.jsx'
import { categories, effects, effectsByCategory } from './registry.js'

const heroEffect = effects.find(e => e.id === 'CY-01')

/** Landing screen: LiquidChrome backdrop, title and the chapter directory. */
export default function Hero() {
  const done = effects.filter(e => e.status === 'done').length
  const go = id => document.getElementById(`chapter-${id}`)?.scrollIntoView({ behavior: 'smooth' })

  return (
    <section className="hero">
      <LazyMount className="hero__bg"><EffectView effect={heroEffect} /></LazyMount>
      <div className="hero__copy">
        <p className="hero__eyebrow">CLAUDE MOTION LAB · {categories.length} CHAPTERS · {done}/{effects.length} EFFECTS</p>
        <h1 className="hero__title">Claude<br />Motion Lab</h1>
        <p className="hero__hint">原创 3D 与 UI 动效组件 · 移动鼠标让金属鼓起 · 点击荡开涟漪 · 向下滚动</p>
      </div>
      <ol className="hero__toc">
        {categories.map(c => {
          const list = effectsByCategory(c.id)
          return (
            <li key={c.id}>
              <button onClick={() => go(c.id)} style={{ '--accent': c.accent }}>
                <span className="hero__toc-prefix">{c.prefix}</span>
                <span className="hero__toc-title">{c.title}</span>
                <span className="hero__toc-count">{list.filter(e => e.status === 'done').length}/{list.length}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
