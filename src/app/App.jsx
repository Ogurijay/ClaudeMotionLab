import Hero from './Hero.jsx'
import Chapter from './Chapter.jsx'
import ChapterNav from './ChapterNav.jsx'
import QualityToggle from './QualityToggle.jsx'
import { categories } from './registry.js'

export default function App() {
  return (
    <main>
      <Hero />
      <ChapterNav />
      <QualityToggle />
      {categories.map(c => <Chapter key={c.id} category={c} />)}
      <footer className="foot">
        Claude Motion Lab — built from scratch with React · Three.js · GLSL · PolyForm Noncommercial 1.0.0
      </footer>
    </main>
  )
}
