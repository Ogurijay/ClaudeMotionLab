// Showcase-specific wrappers for effects that need more than <Effect /> to demo well.
// Keyed by effect id; receives the loaded component. Effects without an entry render as <Effect />.

// lighter workloads on phones and small tablets
const small = () => window.innerWidth < 700

export const demos = {
  'CY-02': ParticleMorph => <ParticleMorph words={['MOTION', 'LAB']} count={small() ? 9000 : 18000} />,
  'OR-01': GrassField => <GrassField count={small() ? 20000 : 60000} />,
  'OR-02': Fireflies => <Fireflies count={small() ? 110 : 180} />,
  'CY-03': HoloCard => (
    <div className="cards">
      <HoloCard number="07" title="Aurora Prism" subtitle="Rare · Holographic" hue={265} emblem="prism" />
      <HoloCard number="12" title="Orbit Core" subtitle="Epic · Foil" hue={185} emblem="rings" />
      <HoloCard number="23" title="Nova Flux" subtitle="Legendary · Galaxy" hue={330} emblem="orbit" />
    </div>
  ),
  'CY-04': KineticType => <div className="kt-stage"><KineticType text="MAKE IT MOVE" /></div>,
  'PP-05': Scribble => (
    <div className="scrib-demo">
      <p>
        Every <Scribble variant="circle" color="#e11d48">sketch</Scribble> starts as a{' '}
        <Scribble variant="underline" color="#2563eb">messy</Scribble> idea — it gets{' '}
        <Scribble variant="highlight" color="#facc15">circled</Scribble>,{' '}
        <Scribble variant="strike" color="#111827">crossed out</Scribble>, and finally{' '}
        <Scribble variant="box" color="#16a34a">shipped</Scribble>.
      </p>
      <p className="scrib-demo__cn">
        <Scribble variant="underline" color="#e11d48">手写</Scribble>的批注，让界面多一点
        <Scribble variant="circle" color="#2563eb">温度</Scribble>。
      </p>
    </div>
  ),
}
