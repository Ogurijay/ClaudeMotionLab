// Shared performance governor: a user-selectable quality level, DPR caps, and a
// frame-time driven resolution scaler that effects use to stay smooth on weaker GPUs.

const KEY = 'cml-quality'
const LEVELS = ['auto', 'high', 'low']
let level = (typeof localStorage !== 'undefined' && LEVELS.includes(localStorage.getItem(KEY)) && localStorage.getItem(KEY)) || 'auto'
const subscribers = new Set()

/** Current quality level: 'auto' (adaptive), 'high' (fixed full resolution) or 'low' (power saving). */
export const getQuality = () => level

export function setQuality(next) {
  if (!LEVELS.includes(next) || next === level) return
  level = next
  try { localStorage.setItem(KEY, next) } catch { /* private mode */ }
  subscribers.forEach(fn => fn(next))
}

/** Subscribe to quality changes; returns an unsubscribe function. */
export function onQuality(fn) {
  subscribers.add(fn)
  return () => subscribers.delete(fn)
}

/** Device pixel ratio an effect should render at, given its own cap. */
export function targetDpr(cap = 1.5) {
  const dpr = Math.min(window.devicePixelRatio || 1, cap)
  return level === 'low' ? Math.min(dpr, 0.75) : dpr
}

/**
 * Frame-time based resolution scaler. Call `tick(dtMs)` once per rendered frame;
 * it returns true when `scale` changed (then re-size the canvas / renderer).
 * In 'auto' the scale drops quickly when frames run slower than ~50 fps and
 * recovers slowly with headroom; 'high' and 'low' pin it to 1.
 */
export function createScaler({ min = 0.5 } = {}) {
  let scale = 1, avg = 16.7, frames = 0
  return {
    get scale() { return scale },
    tick(dt) {
      if (level !== 'auto') {
        if (scale === 1) return false
        scale = 1
        return true
      }
      avg += (Math.min(dt, 100) - avg) * 0.08
      frames++
      if (frames > 24 && avg > 20.5 && scale > min) {
        scale = Math.max(min, scale * 0.8)
        frames = 0
        return true
      }
      if (frames > 150 && avg < 17.8 && scale < 1) {
        scale = Math.min(1, scale * 1.12)
        frames = 0
        return true
      }
      return false
    },
    /** forget the running average (e.g. after the effect was paused offscreen) */
    reset() { avg = 16.7; frames = 0 },
  }
}

/**
 * Adaptive pixel ratio for a Three.js renderer. Call `frame(isVisible)` at the top of
 * each animation frame (it returns false while paused); when the scale changes the
 * pixel ratio is updated and `onResize` is called so the renderer re-sizes.
 */
export function adaptiveRenderer(renderer, cap, onResize) {
  const scaler = createScaler()
  let last = 0
  const apply = () => renderer.setPixelRatio(targetDpr(cap) * scaler.scale)
  apply()
  const off = onQuality(() => { scaler.reset(); apply(); onResize?.() })
  return {
    frame(active) {
      if (!active) { last = 0; return false }
      const now = performance.now()
      if (!last) scaler.reset()
      else if (scaler.tick(now - last)) { apply(); onResize?.() }
      last = now
      return true
    },
    dispose: off,
  }
}
