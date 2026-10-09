import { useEffect, useRef } from 'react'

// Returns a ref-like object whose .current tracks whether the element is on screen,
// so render loops can skip work while scrolled out of view.
export function useVisibility(targetRef, rootMargin = '120px') {
  const visible = useRef(false)
  useEffect(() => {
    const el = targetRef.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => { visible.current = entry.isIntersecting }, { rootMargin })
    io.observe(el)
    return () => io.disconnect()
  }, [targetRef, rootMargin])
  return visible
}
