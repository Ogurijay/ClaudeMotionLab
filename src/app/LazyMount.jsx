import { useEffect, useRef, useState } from 'react'

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
    const near = new IntersectionObserver(([e]) => { if (e.isIntersecting) setMounted(true) },
      { rootMargin: `${mountMargin} 0px` })
    const far = new IntersectionObserver(([e]) => { if (!e.isIntersecting) setMounted(false) },
      { rootMargin: `${unmountMargin} 0px` })
    near.observe(el)
    far.observe(el)
    return () => { near.disconnect(); far.disconnect() }
  }, [mountMargin, unmountMargin])

  return <div ref={ref} style={style} className={className}>{mounted ? children : null}</div>
}
