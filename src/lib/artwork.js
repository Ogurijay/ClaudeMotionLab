// Procedural artwork drawn on a 2D canvas, used as image sources for shader effects
// (so effects need no external image assets). Every function takes the target size.

/** Neon synth poster: gradient sky, striped sun, perspective grid, headline. */
export function neonPoster(w, h, title = 'GLITCH') {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const g = c.getContext('2d')
  const sky = g.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, '#0b0322')
  sky.addColorStop(0.55, '#5b0f6b')
  sky.addColorStop(0.62, '#ff4f9a')
  sky.addColorStop(0.62, '#12051f')
  sky.addColorStop(1, '#05010d')
  g.fillStyle = sky
  g.fillRect(0, 0, w, h)
  // sun
  const r = h * 0.2, cx = w * 0.5, cy = h * 0.5
  const sun = g.createLinearGradient(0, cy - r, 0, cy + r)
  sun.addColorStop(0, '#ffe66d')
  sun.addColorStop(1, '#ff3d7f')
  g.save()
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.clip()
  g.fillStyle = sun
  g.fillRect(cx - r, cy - r, r * 2, r * 2)
  g.fillStyle = '#5b0f6b'
  for (let i = 0; i < 6; i++) g.fillRect(cx - r, cy + i * r * 0.16, r * 2, 2 + i * 2.2)
  g.restore()
  // grid floor
  g.strokeStyle = 'rgba(0, 240, 255, 0.7)'
  g.lineWidth = 1.5
  const hz = h * 0.62
  for (let i = -20; i <= 20; i++) { g.beginPath(); g.moveTo(cx + i * w * 0.02, hz); g.lineTo(cx + i * w * 0.2, h); g.stroke() }
  for (let k = 1; k < 12; k++) { const y = hz + (h - hz) * Math.pow(k / 12, 1.8); g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke() }
  // headline
  g.fillStyle = '#f5f3ff'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = `900 ${Math.min(h * 0.2, w / (title.length * 0.75))}px Inter, "Arial Black", sans-serif`
  g.shadowColor = '#00f0ff'
  g.shadowBlur = h * 0.03
  g.fillText(title, cx, h * 0.2)
  g.shadowBlur = 0
  g.font = `500 ${Math.max(11, h * 0.024)}px "JetBrains Mono", monospace`
  g.fillStyle = 'rgba(245, 243, 255, 0.8)'
  g.fillText('CLAUDE MOTION LAB · SIGNAL LOST · 2026', cx, h * 0.32)
  return c
}

/** Painterly landscape: layered mountains, lake with reflections, soft sky. */
export function landscape(w, h) {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const g = c.getContext('2d')
  const sky = g.createLinearGradient(0, 0, 0, h * 0.6)
  sky.addColorStop(0, '#7dd3fc')
  sky.addColorStop(1, '#fde68a')
  g.fillStyle = sky
  g.fillRect(0, 0, w, h)
  g.fillStyle = 'rgba(255,255,255,0.9)'
  g.beginPath(); g.arc(w * 0.72, h * 0.22, h * 0.08, 0, Math.PI * 2); g.fill()
  const ridge = (base, amp, freq, seed, color) => {
    g.fillStyle = color
    g.beginPath()
    g.moveTo(0, h)
    for (let x = 0; x <= w; x += 4) {
      const t = x / w
      const y = base - amp * (0.6 * Math.abs(Math.sin(t * freq + seed)) + 0.4 * Math.abs(Math.sin(t * freq * 2.7 + seed * 2)))
      g.lineTo(x, y)
    }
    g.lineTo(w, h)
    g.fill()
  }
  ridge(h * 0.58, h * 0.3, 3.1, 1.2, '#93a5c8')
  ridge(h * 0.6, h * 0.22, 4.3, 4.1, '#5e7398')
  ridge(h * 0.62, h * 0.14, 6.2, 2.4, '#33476b')
  // lake mirrors the sky
  const lake = g.createLinearGradient(0, h * 0.62, 0, h)
  lake.addColorStop(0, '#9fd2ea')
  lake.addColorStop(1, '#2c5a7a')
  g.fillStyle = lake
  g.fillRect(0, h * 0.62, w, h * 0.38)
  g.fillStyle = 'rgba(255,255,255,0.35)'
  for (let i = 0; i < 40; i++) g.fillRect(Math.random() * w, h * (0.64 + Math.random() * 0.34), w * (0.02 + Math.random() * 0.06), 2)
  // pines
  g.fillStyle = '#14281f'
  for (let i = 0; i < 26; i++) {
    const x = (i / 26) * w + Math.random() * 20, s = h * (0.06 + Math.random() * 0.08), y = h * 0.63
    g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + s * 0.3, y); g.lineTo(x - s * 0.3, y); g.fill()
  }
  return c
}

/** Holographic ID card / blueprint: frame, portrait, data lines, barcode. */
export function idCard(w, h) {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const g = c.getContext('2d')
  g.fillStyle = '#000'
  g.fillRect(0, 0, w, h)
  const cw = Math.min(w * 0.7, h * 1.2), ch = cw * 0.62
  const x0 = (w - cw) / 2, y0 = (h - ch) / 2
  g.strokeStyle = '#fff'
  g.fillStyle = '#fff'
  g.lineWidth = Math.max(2, cw * 0.004)
  g.strokeRect(x0, y0, cw, ch)
  g.strokeRect(x0 + cw * 0.02, y0 + cw * 0.02, cw * 0.96, ch - cw * 0.04)
  // portrait: head + shoulders
  const px = x0 + cw * 0.2, py = y0 + ch * 0.45
  g.beginPath(); g.arc(px, py - ch * 0.08, ch * 0.13, 0, Math.PI * 2); g.stroke()
  g.beginPath(); g.ellipse(px, py + ch * 0.22, ch * 0.22, ch * 0.14, 0, Math.PI, 0); g.stroke()
  g.strokeRect(px - ch * 0.26, py - ch * 0.32, ch * 0.52, ch * 0.66)
  g.font = `700 ${ch * 0.09}px Inter, "Arial Black", sans-serif`
  g.fillText('AGENT · CML-08', x0 + cw * 0.42, y0 + ch * 0.22)
  g.font = `500 ${ch * 0.045}px "JetBrains Mono", monospace`
  const rows = ['CLEARANCE ....... LEVEL 5', 'SECTOR .......... HOLO-LAB', 'ISSUED .......... 2026.10.10', 'STATUS .......... VERIFIED']
  rows.forEach((t, i) => g.fillText(t, x0 + cw * 0.42, y0 + ch * (0.36 + i * 0.09)))
  for (let i = 0; i < 46; i++) {
    const bw = (i * 7) % 3 + 1
    g.fillRect(x0 + cw * 0.42 + i * cw * 0.0105, y0 + ch * 0.76, bw * cw * 0.002, ch * 0.12)
  }
  return c
}
