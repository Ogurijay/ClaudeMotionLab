import DefaultIntro from './DefaultIntro.jsx'

/** Glass & Light chapter intro: the header sits in darkness until a bright beam sweeps across and leaves it lit. */
export default function GlassTransition({ category, active }) {
  return (
    <>
      <DefaultIntro category={category} active={active} />
      <div className={`tx-beam ${active ? 'is-on' : ''}`} aria-hidden="true" />
    </>
  )
}
