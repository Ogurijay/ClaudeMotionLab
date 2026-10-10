// Showcase-specific wrappers for effects that need more than <Effect /> to demo well.
// Keyed by effect id; receives the loaded component. Effects without an entry render as <Effect />.

export const demos = {
  'CY-02': ParticleMorph => <ParticleMorph words={['MOTION', 'LAB']} />,
  'CY-03': HoloCard => (
    <div className="cards">
      <HoloCard number="07" title="Aurora Prism" subtitle="Rare · Holographic" hue={265} emblem="prism" />
      <HoloCard number="12" title="Orbit Core" subtitle="Epic · Foil" hue={185} emblem="rings" />
      <HoloCard number="23" title="Nova Flux" subtitle="Legendary · Galaxy" hue={330} emblem="orbit" />
    </div>
  ),
  'CY-04': KineticType => <div className="kt-stage"><KineticType text="MAKE IT MOVE" /></div>,
}
