/** Default chapter intro: an accent line wipes in, followed by the chapter prefix. */
export default function DefaultIntro({ category, active }) {
  return (
    <div className={`chapter__intro ${active ? 'is-in' : ''}`}>
      <span className="chapter__line" />
      <span className="chapter__prefix">{category.prefix}</span>
    </div>
  )
}
