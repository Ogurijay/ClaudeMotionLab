import { useEffect, useState } from 'react'
import { getQuality, onQuality, setQuality } from '../lib/perf'

const OPTIONS = [
  { id: 'auto', label: '自动', title: '根据帧率自动调整渲染分辨率' },
  { id: 'high', label: '高', title: '始终以最高分辨率渲染' },
  { id: 'low', label: '省电', title: '降低渲染分辨率，适合集成显卡与笔记本电池模式' },
]

/** Fixed quality switch: auto (adaptive resolution) / high / power saving. Persisted in localStorage. */
export default function QualityToggle() {
  const [level, setLevel] = useState(getQuality)
  useEffect(() => onQuality(setLevel), [])
  return (
    <div className="quality" role="radiogroup" aria-label="画质">
      <span className="quality__label">画质</span>
      {OPTIONS.map(o => (
        <button key={o.id} role="radio" aria-checked={level === o.id} title={o.title}
          className={level === o.id ? 'is-active' : ''} onClick={() => setQuality(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
