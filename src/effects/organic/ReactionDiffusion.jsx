import { useEffect, useRef, useState } from 'react'
import { createSim } from '../../lib/glsim'
import { useVisibility } from '../../hooks/useVisibility'
import { createScaler } from '../../lib/perf'
import './ReactionDiffusion.css'

// Gray–Scott feed / kill rates that produce distinct families of patterns
const PRESETS = {
  coral: { f: 0.0545, k: 0.062 },
  mitosis: { f: 0.0367, k: 0.0649 },
  maze: { f: 0.029, k: 0.057 },
  worms: { f: 0.078, k: 0.061 },
}

const HEAD = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
`

const STEP = HEAD + /* glsl */ `
uniform sampler2D uState;   // r = A, g = B
uniform vec2 uTexel;
uniform float uFeed;
uniform float uKill;
void main() {
  vec2 c = texture(uState, vUv).rg;
  // 9-point Laplacian (adjacent 0.2, diagonal 0.05, centre -1)
  vec2 lap = -c;
  lap += 0.2 * (texture(uState, vUv + vec2(uTexel.x, 0.0)).rg + texture(uState, vUv - vec2(uTexel.x, 0.0)).rg
              + texture(uState, vUv + vec2(0.0, uTexel.y)).rg + texture(uState, vUv - vec2(0.0, uTexel.y)).rg);
  lap += 0.05 * (texture(uState, vUv + uTexel).rg + texture(uState, vUv - uTexel).rg
               + texture(uState, vUv + vec2(uTexel.x, -uTexel.y)).rg + texture(uState, vUv + vec2(-uTexel.x, uTexel.y)).rg);
  float a = c.r, b = c.g, abb = a * b * b;
  float na = a + (1.0 * lap.r - abb + uFeed * (1.0 - a));
  float nb = b + (0.5 * lap.g + abb - (uKill + uFeed) * b);
  o = vec4(clamp(na, 0.0, 1.0), clamp(nb, 0.0, 1.0), 0.0, 1.0);
}`

const SEED = HEAD + /* glsl */ `
uniform sampler2D uState;
uniform vec2 uPoint;
uniform float uRadius;
uniform float uAspect;
void main() {
  vec2 c = texture(uState, vUv).rg;
  vec2 d = vUv - uPoint;
  d.x *= uAspect;
  if (length(d) < uRadius) c = vec2(0.5, 0.9);
  o = vec4(c, 0.0, 1.0);
}`

const RESET = HEAD + `void main() { o = vec4(1.0, 0.0, 0.0, 1.0); }`

const DISPLAY = HEAD + /* glsl */ `
uniform sampler2D uState;
uniform vec2 uTexel;
void main() {
  float b = texture(uState, vUv).g;
  // emboss lighting from the B gradient
  float bx = texture(uState, vUv + vec2(uTexel.x, 0.0)).g - texture(uState, vUv - vec2(uTexel.x, 0.0)).g;
  float by = texture(uState, vUv + vec2(0.0, uTexel.y)).g - texture(uState, vUv - vec2(0.0, uTexel.y)).g;
  vec3 n = normalize(vec3(-bx * 6.0, -by * 6.0, 1.0));
  float light = clamp(dot(n, normalize(vec3(-0.5, 0.6, 0.6))), 0.0, 1.0);
  float t = smoothstep(0.08, 0.42, b);
  vec3 col = mix(vec3(0.02, 0.05, 0.03), vec3(0.12, 0.3, 0.1), smoothstep(0.0, 0.3, t));
  col = mix(col, vec3(0.62, 0.84, 0.3), smoothstep(0.3, 0.75, t));
  col = mix(col, vec3(0.97, 0.95, 0.78), smoothstep(0.75, 1.0, t));
  col *= 0.65 + 0.55 * light;
  o = vec4(col, 1.0);
}`

/**
 * Gray–Scott reaction–diffusion growing Turing patterns in real time:
 * coral, cell division, mazes and worms. Hover to seed new growth.
 */
export default function ReactionDiffusion({ preset = 'coral', resolution = 0.4, stepsPerFrame = 10 }) {
  const canvasRef = useRef(null)
  const visible = useVisibility(canvasRef)
  const [mode, setMode] = useState(PRESETS[preset] ? preset : 'coral')
  const modeRef = useRef(mode)
  modeRef.current = mode
  const resetRef = useRef(() => {})
  const key = `${resolution}|${stepsPerFrame}`

  useEffect(() => {
    const canvas = canvasRef.current
    const sim = createSim(canvas)
    if (!sim) return
    const { gl } = sim
    const P = { step: sim.program(STEP), seed: sim.program(SEED), reset: sim.program(RESET), display: sim.program(DISPLAY) }
    let state, aspect = 1, needsReset = true

    const seed = (x, y, r) => {
      P.seed.use()
      gl.uniform1i(P.seed.u.uState, state.read.bind(0))
      gl.uniform2f(P.seed.u.uPoint, x, y)
      gl.uniform1f(P.seed.u.uRadius, r)
      gl.uniform1f(P.seed.u.uAspect, aspect)
      sim.draw(state.write); state.swap()
    }
    const reset = () => {
      P.reset.use()
      sim.draw(state.write); state.swap()
      for (let i = 0; i < 14; i++) seed(0.1 + Math.random() * 0.8, 0.15 + Math.random() * 0.7, 0.012 + Math.random() * 0.02)
    }
    const build = () => {
      const r = canvas.getBoundingClientRect()
      canvas.width = Math.max(1, r.width | 0)
      canvas.height = Math.max(1, r.height | 0)
      aspect = canvas.width / canvas.height
      state = sim.doubleTarget(Math.max(64, (canvas.width * resolution) | 0), Math.max(64, (canvas.height * resolution) | 0), gl.NEAREST, 'float')
      needsReset = true
    }
    build()
    resetRef.current = reset

    const ptr = { x: 0, y: 0, inside: false }
    const onMove = e => {
      const r = canvas.getBoundingClientRect()
      ptr.x = (e.clientX - r.left) / r.width; ptr.y = 1 - (e.clientY - r.top) / r.height; ptr.inside = true
    }
    const onLeave = () => { ptr.inside = false }
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerleave', onLeave)
    const ro = new ResizeObserver(() => {
      const r = canvas.getBoundingClientRect()
      if (Math.abs(r.width - canvas.width) > 2 || Math.abs(r.height - canvas.height) > 2) build()
    })
    ro.observe(canvas)

    // fewer simulation steps per frame when frames run slow (patterns just grow more slowly)
    const scaler = createScaler({ min: 0.4 })
    let raf, last = 0
    const loop = now => {
      raf = requestAnimationFrame(loop)
      if (!visible.current || !sim.ready()) { last = 0; return }
      if (needsReset) { needsReset = false; reset() }
      if (last) scaler.tick(now - last); else scaler.reset()
      last = now
      const steps = Math.max(3, Math.round(stepsPerFrame * scaler.scale))
      if (ptr.inside) seed(ptr.x, ptr.y, 0.01)
      const { f, k } = PRESETS[modeRef.current]
      P.step.use()
      gl.uniform2f(P.step.u.uTexel, ...state.texel)
      gl.uniform1f(P.step.u.uFeed, f)
      gl.uniform1f(P.step.u.uKill, k)
      for (let i = 0; i < steps; i++) {
        gl.uniform1i(P.step.u.uState, state.read.bind(0))
        sim.draw(state.write); state.swap()
      }
      P.display.use()
      gl.uniform2f(P.display.u.uTexel, ...state.texel)
      gl.uniform1i(P.display.u.uState, state.read.bind(0))
      sim.draw(null)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerleave', onLeave)
      sim.dispose()
    }
  }, [key, resolution, stepsPerFrame, visible])

  return (
    <div className="rd">
      <canvas key={key} ref={canvasRef} className="fx-canvas" />
      <div className="rd__presets">
        {Object.keys(PRESETS).map(p => (
          <button key={p} className={p === mode ? 'is-active' : ''} onClick={() => setMode(p)}>{p}</button>
        ))}
        <button onClick={() => resetRef.current()}>reset</button>
      </div>
    </div>
  )
}
