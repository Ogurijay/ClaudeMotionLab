// Custom chapter intro transitions, keyed by category id.
// Each receives { category, active } and replaces the default intro for its chapter.
import PixelTransition from './PixelTransition.jsx'

export const transitions = {
  pixel: PixelTransition,
}
