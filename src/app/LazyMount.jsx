import { useEffect, useRef, useState } from 'react'

// Mounting is serialised through a small priority queue so heavy effects initialise one at
// a time instead of several landing in the same frame mid-scroll. Each turn mounts the
// effect closest to the viewport centre: one already on screen goes almost immediately,
// off-screen pre-mounts wait for an idle moment.
const queue = new Set()   // { el, mount }
let pending = null        // { fast, cancel } for the turn currently scheduled
const ric = window.requestIdleCallback ?? ((cb, o) => setTimeout(cb, Math.min(o?.timeout ?? 40, 40)))
const cic = window.cancelIdleCallback ?? clearTimeout

const distance = el => {
  const r = el.getBoundingClientRect()
  return Math.abs(r.top + r.height / 2 - window.innerHeight / 2)
}
const onScreen = el => {
  const r = el.getBoundingClientRect()
  return r.bottom > 0 && r.top < window.innerHeight
}

function pump() {
  if (!queue.size) return
  let best = null, bd = Infinity
  for (const job of queue) { const d = distance(job.el); if (d < bd) { bd = d; best = job } }
  const fast = onScreen(best.el)
  if (pending) {
    // an on-screen effect jumps ahead of an off-screen pre-mount that is still waiting for idle time
    if (pending.fast || !fast) return
    pending.cancel()
  }
  const run = () => {
    pending = null
    // re-pick at run time: the user may have scrolled since this turn was scheduled
    let job = null, d0 = Infinity
    for (const j of queue) { const d = distance(j.el); if (d < d0) { d0 = d; job = j } }
    if (job && queue.delete(job)) job.mount()
    pump()
  }
  if (fast) { const id = setTimeout(run, 50); pending = { fast, cancel: () => clearTimeout(id) } }
  else { const id = ric(run, { timeout: 600 }); pending = { fast, cancel: () => cic(id) } }
}

/**
 * Mounts children only while the wrapper is near the viewport, and unmounts them
 * once it is far away. The two margins form a hysteresis band so effects at the
 * boundary don't flicker in and out. This keeps live WebGL contexts within budget.
 */
export default function LazyMount({ children, mountMargin = '100%', unmountMargin = '200%', style, className }) {
  const ref = useRef(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const el = ref.current
    const job = { el, mount: () => setMounted(true) }
    const near = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { queue.add(job); pump() }
    }, { rootMargin: `${mountMargin} 0px` })
    const far = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) return
      queue.delete(job)
      setMounted(false)
    }, { rootMargin: `${unmountMargin} 0px` })
    near.observe(el)
    far.observe(el)
    return () => { queue.delete(job); near.disconnect(); far.disconnect() }
  }, [mountMargin, unmountMargin])

  return <div ref={ref} style={style} className={className}>{mounted ? children : null}</div>
}
