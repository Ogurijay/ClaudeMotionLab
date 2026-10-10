import { lazy, Suspense } from 'react'
import { demos } from './demos.jsx'

// One lazy component per effect id, created once so React keeps its identity.
const cache = new Map()
function lazyEffect(effect) {
  if (!cache.has(effect.id)) {
    cache.set(effect.id, lazy(() => effect.load().then(mod => {
      const Effect = mod.default
      const render = demos[effect.id]
      return { default: () => (render ? render(Effect) : <Effect />) }
    })))
  }
  return cache.get(effect.id)
}

/** Loads an effect's module on first render and shows its demo. */
export default function EffectView({ effect }) {
  const Component = lazyEffect(effect)
  return (
    <Suspense fallback={<div className="stage-loading">loading {effect.name}…</div>}>
      <Component />
    </Suspense>
  )
}
