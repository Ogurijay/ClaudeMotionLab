import DefaultIntro from './DefaultIntro.jsx'

const STRIPS = 8

/** Paper chapter intro: paper strips cover the header, then fold away one after another like an unfolding sheet. */
export default function PaperTransition({ category, active }) {
  return (
    <>
      <DefaultIntro category={category} active={active} />
      <div className={`tx-paper ${active ? 'is-open' : ''}`} aria-hidden="true">
        {Array.from({ length: STRIPS }, (_, i) => (
          <span key={i} style={{ transitionDelay: `${i * 70}ms`, background: i % 2 ? '#e7dfcc' : '#efe8d8' }} />
        ))}
      </div>
    </>
  )
}
