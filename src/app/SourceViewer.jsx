import { useEffect, useMemo, useState } from 'react'
import { highlight } from 'sugar-high'

// Raw source of every effect file and the shared code effects depend on, loaded on demand.
const sources = {
  ...import.meta.glob('../effects/**/*.{jsx,js,css}', { query: '?raw', import: 'default' }),
  ...import.meta.glob('../hooks/*.js', { query: '?raw', import: 'default' }),
  ...import.meta.glob('../lib/*.js', { query: '?raw', import: 'default' }),
}
// registry `files` are relative to src/effects/ (shared code is referenced as '../hooks/…')
const sourceKey = f => `../effects/${f}`.replace('/effects/../', '/')

/**
 * Extracts the destructured props of `export default function Name({ a = 1, b })`
 * as [{ name, def }]. Good enough for this codebase's component signatures.
 */
export function parseProps(src) {
  const m = src.match(/export default function \w+\(\s*\{/)
  if (!m) return []
  let i = m.index + m[0].length
  const start = i
  let depth = 1
  while (i < src.length && depth > 0) {
    const c = src[i]
    if ('{[('.includes(c)) depth++
    else if ('}])'.includes(c)) depth--
    i++
  }
  const body = src.slice(start, i - 1)

  const parts = []
  let cur = '', d = 0, quote = null
  for (const c of body) {
    if (quote) { cur += c; if (c === quote) quote = null; continue }
    if (c === "'" || c === '"' || c === '`') { quote = c; cur += c; continue }
    if ('{[('.includes(c)) d++
    if ('}])'.includes(c)) d--
    if (c === ',' && d === 0) { parts.push(cur); cur = '' } else cur += c
  }
  parts.push(cur)

  return parts.map(p => p.trim()).filter(Boolean).map(p => {
    const eq = p.indexOf('=')
    return eq < 0 ? { name: p, def: null } : { name: p.slice(0, eq).trim(), def: p.slice(eq + 1).trim() }
  })
}

/** Slide-over panel showing an effect's props and highlighted source files. */
export default function SourceViewer({ effect, onClose }) {
  const [files, setFiles] = useState(null)
  const [tab, setTab] = useState('props')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let alive = true
    Promise.all(effect.files.map(f => sources[sourceKey(f)]?.() ?? Promise.resolve('// source not found')))
      .then(list => alive && setFiles(Object.fromEntries(effect.files.map((f, i) => [f, list[i]]))))
    return () => { alive = false }
  }, [effect])

  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const props = useMemo(() => (files ? parseProps(files[effect.files[0]]) : []), [files, effect])
  const code = files && tab !== 'props' ? files[tab] : null
  const html = useMemo(() => (code ? highlight(code) : ''), [code])

  const copy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  return (
    <div className="src" role="dialog" aria-modal="true" aria-label={`${effect.name} source`}>
      <div className="src__backdrop" onClick={onClose} />
      <aside className="src__panel">
        <header className="src__head">
          <div>
            <span className="src__id">{effect.id}</span>
            <h3 className="src__name">{`<${effect.name} />`}</h3>
            <p className="src__path">src/effects/{effect.files[0]}</p>
          </div>
          <button className="src__close" onClick={onClose} aria-label="Close">✕</button>
        </header>

        <nav className="src__tabs">
          <button className={tab === 'props' ? 'is-active' : ''} onClick={() => setTab('props')}>Props</button>
          {effect.files.map(f => (
            <button key={f} className={tab === f ? 'is-active' : ''} onClick={() => setTab(f)}>{f.split('/').pop()}</button>
          ))}
          {code && <button className="src__copy" onClick={copy}>{copied ? '已复制 ✓' : '复制代码'}</button>}
        </nav>

        <div className="src__body">
          {!files && <p className="src__muted">loading…</p>}
          {files && tab === 'props' && (
            props.length ? (
              <table className="src__props">
                <thead><tr><th>prop</th><th>default</th></tr></thead>
                <tbody>
                  {props.map(p => (
                    <tr key={p.name}><td><code>{p.name}</code></td><td><code>{p.def ?? '—'}</code></td></tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="src__muted">该组件没有可配置的 props。</p>
          )}
          {code && <pre className="src__code"><code dangerouslySetInnerHTML={{ __html: html }} /></pre>}
        </div>
      </aside>
    </div>
  )
}
