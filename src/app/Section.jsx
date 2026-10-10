import { useState } from 'react'
import LazyMount from './LazyMount.jsx'
import EffectView from './EffectView.jsx'
import SourceViewer from './SourceViewer.jsx'

/** Showcase block for a finished effect: header, source button and a lazily mounted live demo. */
export default function Section({ effect }) {
  const [showSource, setShowSource] = useState(false)
  const bare = effect.layout === 'bare'

  return (
    <section className="demo" id={effect.id}>
      <header className="demo__head">
        <span className="demo__idx">{effect.id}</span>
        <h2 className="demo__name">{`<${effect.name} />`}</h2>
        <div className="demo__tags">
          {effect.tags.map(t => <span key={t}>{t}</span>)}
          <button className="demo__src" onClick={() => setShowSource(true)}>{'</>'} 源码</button>
        </div>
        <p className="demo__hint">{effect.hint}</p>
      </header>

      {bare ? (
        <LazyMount style={{ minHeight: effect.height }}>
          <EffectView effect={effect} />
        </LazyMount>
      ) : (
        <div className="demo__stage">
          <LazyMount className="demo__mount">
            <EffectView effect={effect} />
          </LazyMount>
        </div>
      )}

      {showSource && <SourceViewer effect={effect} onClose={() => setShowSource(false)} />}
    </section>
  )
}
