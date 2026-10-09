import LiquidChrome from './components/LiquidChrome.jsx'
import ParticleMorph from './components/ParticleMorph.jsx'
import HoloCard from './components/HoloCard.jsx'
import KineticType from './components/KineticType.jsx'
import WaveLines from './components/WaveLines.jsx'
import SpiralGallery from './components/SpiralGallery.jsx'

function Section({ idx, name, tags, hint, children, bare = false }) {
  return (
    <section className="demo">
      <header className="demo__head">
        <span className="demo__idx">{idx}</span>
        <h2 className="demo__name">{`<${name} />`}</h2>
        <div className="demo__tags">{tags.map(t => <span key={t}>{t}</span>)}</div>
        <p className="demo__hint">{hint}</p>
      </header>
      {bare ? children : <div className="demo__stage">{children}</div>}
    </section>
  )
}

export default function App() {
  return (
    <main>
      <section className="hero">
        <LiquidChrome />
        <div className="hero__copy">
          <p className="hero__eyebrow">CLAUDE MOTION LAB · 6 ORIGINAL COMPONENTS</p>
          <h1 className="hero__title">Liquid<br />Chrome</h1>
          <p className="hero__hint">移动鼠标让金属鼓起 · 点击荡开涟漪 · 向下滚动</p>
        </div>
      </section>

      <Section idx="01" name="ParticleMorph" tags={['Three.js', 'GLSL', '18k particles']} hint="自动变形 · 点击切换形态 · 鼠标靠近粒子会被推开">
        <ParticleMorph words={['MOTION', 'LAB']} />
      </Section>

      <Section idx="02" name="HoloCard" tags={['CSS 3D', 'blend modes', 'spring physics']} hint="鼠标在卡面上移动 —— 箔面、闪粉、高光与图层视差">
        <div className="cards">
          <HoloCard number="07" title="Aurora Prism" subtitle="Rare · Holographic" hue={265} emblem="prism" />
          <HoloCard number="12" title="Orbit Core" subtitle="Epic · Foil" hue={185} emblem="rings" />
          <HoloCard number="23" title="Nova Flux" subtitle="Legendary · Galaxy" hue={330} emblem="orbit" />
        </div>
      </Section>

      <Section idx="03" name="KineticType" tags={['Variable font', 'spring physics']} hint="把鼠标划过文字 —— 字重、位移和倾斜都由物理驱动">
        <div className="kt-stage"><KineticType text="MAKE IT MOVE" /></div>
      </Section>

      <Section idx="04" name="WaveLines" tags={['Canvas 2D', 'noise', 'occlusion']} hint="鼠标在画面里移动会隆起山峰">
        <WaveLines />
      </Section>

      <Section idx="05" name="SpiralGallery" tags={['Three.js', 'scroll-driven', 'GLSL']} hint="继续向下滚动穿过隧道 —— 滚得越快，卡片越弯、色散越强" bare>
        <SpiralGallery />
      </Section>

      <footer className="foot">Claude Motion Lab — built from scratch with React · Three.js · GLSL</footer>
    </main>
  )
}
