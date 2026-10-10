/** Showcase block: index, component name, tech tags, interaction hint and a live stage. */
export default function Section({ idx, name, tags, hint, children, bare = false }) {
  return (
    <section className="demo">
      <header className="demo__head">
        <span className="demo__idx">{idx}</span>
        <h2 className="demo__name">{`<${name} />`}</h2>
        <div className="demo__tags">{tags.map(t => <span key={t}>{t}</span>)}</div>
        <p className="demo__hint">{hint}</p>
      </header>
      {bare ? children : <div className="demo__stage">{children}</div>}
    </section>
  )
}
