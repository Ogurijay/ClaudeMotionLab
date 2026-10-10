// Custom chapter intro transitions, keyed by category id.
// Each receives { category, active } and replaces the default intro for its chapter.
import PixelTransition from './PixelTransition.jsx'
import LiquidTransition from './LiquidTransition.jsx'
import OrganicTransition from './OrganicTransition.jsx'
import PaperTransition from './PaperTransition.jsx'
import GlassTransition from './GlassTransition.jsx'

export const transitions = {
  pixel: PixelTransition,
  liquid: LiquidTransition,
  organic: OrganicTransition,
  paper: PaperTransition,
  glass: GlassTransition,
}
