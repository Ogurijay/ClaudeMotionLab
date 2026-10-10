import { useEffect, useRef } from 'react'
import { createSim } from '../../lib/glsim'
import { useVisibility } from '../../hooks/useVisibility'
import { targetDpr } from '../../lib/perf'

// ---------- passes (stable fluids on a staggered-free grid) ----------

const HEAD = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
`

const SPLAT = HEAD + /* glsl */ `
uniform sampler2D uTarget;
uniform vec2 uPoint;
uniform vec3 uValue;
uniform float uRadius;
uniform float uAspect;
void main() {
  vec2 d = vUv - uPoint;
  d.x *= uAspect;
  vec3 base = texture(uTarget, vUv).xyz;
  o = vec4(base + uValue * exp(-dot(d, d) / uRadius), 1.0);
}`

const ADVECT = HEAD + /* glsl */ `
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 uTexel;
uniform float uDt;
uniform float uDissipation;
void main() {
  vec2 coord = vUv - uDt * texture(uVelocity, vUv).xy * uTexel;
  o = vec4(texture(uSource, coord).xyz / (1.0 + uDissipation * uDt), 1.0);
}`

// neighbours helper shared by the derivative passes
const NB = /* glsl */ `
uniform vec2 uTexel;
#define L(t) texture(t, vUv - vec2(uTexel.x, 0.0))
#define R(t) texture(t, vUv + vec2(uTexel.x, 0.0))
#define B(t) texture(t, vUv - vec2(0.0, uTexel.y))
#define T(t) texture(t, vUv + vec2(0.0, uTexel.y))
`

const CURL = HEAD + NB + /* glsl */ `
uniform sampler2D uVelocity;
void main() {
  float c = R(uVelocity).y - L(uVelocity).y - T(uVelocity).x + B(uVelocity).x;
  o = vec4(0.5 * c, 0.0, 0.0, 1.0);
}`

const VORTICITY = HEAD + NB + /* glsl */ `
uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform float uStrength;
uniform float uDt;
void main() {
  float l = L(uCurl).x, r = R(uCurl).x, b = B(uCurl).x, t = T(uCurl).x, c = texture(uCurl, vUv).x;
  vec2 force = 0.5 * vec2(abs(t) - abs(b), abs(r) - abs(l));
  force /= length(force) + 1e-4;
  force *= uStrength * c * vec2(1.0, -1.0);
  vec2 v = texture(uVelocity, vUv).xy + force * uDt;
  o = vec4(clamp(v, -1000.0, 1000.0), 0.0, 1.0);
}`

const DIVERGENCE = HEAD + NB + /* glsl */ `
uniform sampler2D uVelocity;
void main() {
  float l = L(uVelocity).x, r = R(uVelocity).x, b = B(uVelocity).y, t = T(uVelocity).y;
  vec2 c = texture(uVelocity, vUv).xy;
  // reflective walls
  if (vUv.x - uTexel.x < 0.0) l = -c.x;
  if (vUv.x + uTexel.x > 1.0) r = -c.x;
  if (vUv.y - uTexel.y < 0.0) b = -c.y;
  if (vUv.y + uTexel.y > 1.0) t = -c.y;
  o = vec4(0.5 * (r - l + t - b), 0.0, 0.0, 1.0);
}`

const FADE = HEAD + /* glsl */ `
uniform sampler2D uSource;
uniform float uValue;
void main() { o = vec4(texture(uSource, vUv).xyz * uValue, 1.0); }`

const PRESSURE = HEAD + NB + /* glsl */ `
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
void main() {
  float p = L(uPressure).x + R(uPressure).x + B(uPressure).x + T(uPressure).x;
  o = vec4((p - texture(uDivergence, vUv).x) * 0.25, 0.0, 0.0, 1.0);
}`

const GRADIENT = HEAD + NB + /* glsl */ `
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
void main() {
  vec2 g = vec2(R(uPressure).x - L(uPressure).x, T(uPressure).x - B(uPressure).x);
  o = vec4(texture(uVelocity, vUv).xy - g, 0.0, 1.0);
}`

const DISPLAY = HEAD + NB + /* glsl */ `
uniform sampler2D uDye;
void main() {
  vec3 c = texture(uDye, vUv).rgb;
  // light the ink as a thin height field so it reads like pigment suspended in water
  float hl = length(L(uDye).rgb), hr = length(R(uDye).rgb), hb = length(B(uDye).rgb), ht = length(T(uDye).rgb);
  vec3 n = normalize(vec3(hl - hr, hb - ht, 0.6));
  float diff = clamp(dot(n, normalize(vec3(-0.4, 0.6, 0.7))), 0.0, 1.0);
  // hue-preserving tone map: keep pigments saturated instead of washing out to white
  float m = max(max(c.r, c.g), c.b);
  vec3 ink = c / max(m, 1e-4) * (1.0 - exp(-m * 1.8));
  vec3 col = vec3(0.012, 0.016, 0.028) + ink * (0.75 + 0.45 * diff);
  col += pow(diff, 24.0) * 0.25 * length(ink);
  o = vec4(col, 1.0);
}`

function hsv(h, s, v) {
  const f = n => { const k = (n + h * 6) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)) }
  return [f(5), f(3), f(1)]
}

/**
 * Real-time GPU fluid (stable fluids with vorticity confinement). Moving the
 * cursor stirs the water and drops cycling ink colours; idle, it splashes itself.
 */
export default function InkFluid({ simResolution = 128, dyeResolution = 640, curl = 28, pressureIterations = 20, inkFade = 0.5 }) {
  const canvasRef = useRef(null)
  const visible = useVisibility(canvasRef)
  const key = `${simResolution}|${dyeResolution}|${curl}|${pressureIterations}|${inkFade}`

  useEffect(() => {
    const canvas = canvasRef.current
    const sim = createSim(canvas)
    if (!sim) return
    const { gl } = sim
    const P = {
      splat: sim.program(SPLAT), advect: sim.program(ADVECT), curl: sim.program(CURL),
      vort: sim.program(VORTICITY), div: sim.program(DIVERGENCE), fade: sim.program(FADE),
      pressure: sim.program(PRESSURE), grad: sim.program(GRADIENT), display: sim.program(DISPLAY),
    }

    let vel, dye, divergence, curlT, pressure, aspect = 1
    const build = () => {
      const r = canvas.getBoundingClientRect()
      const dpr = targetDpr(1.25)
      canvas.width = Math.max(1, (r.width * dpr) | 0)
      canvas.height = Math.max(1, (r.height * dpr) | 0)
      aspect = canvas.width / canvas.height
      const size = base => (aspect >= 1 ? [Math.round(base * aspect), base] : [base, Math.round(base / aspect)])
      const [sw, sh] = size(simResolution), [dw, dh] = size(dyeResolution)
      vel = sim.doubleTarget(sw, sh)
      dye = sim.doubleTarget(dw, dh)
      divergence = sim.target(sw, sh, gl.NEAREST)
      curlT = sim.target(sw, sh, gl.NEAREST)
      pressure = sim.doubleTarget(sw, sh, gl.NEAREST)
    }
    build()

    const splat = (x, y, dx, dy, color, radius = 0.0025) => {
      P.splat.use()
      gl.uniform1f(P.splat.u.uAspect, aspect)
      gl.uniform2f(P.splat.u.uPoint, x, y)
      gl.uniform1f(P.splat.u.uRadius, radius)
      gl.uniform1i(P.splat.u.uTarget, vel.read.bind(0))
      gl.uniform3f(P.splat.u.uValue, dx, dy, 0)
      sim.draw(vel.write); vel.swap()
      gl.uniform1i(P.splat.u.uTarget, dye.read.bind(0))
      gl.uniform3f(P.splat.u.uValue, ...color)
      sim.draw(dye.write); dye.swap()
    }

    let hue = Math.random()
    const nextColor = (v = 0.9) => { hue = (hue + 0.07) % 1; return hsv(hue, 0.85, v) }
    const burst = n => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2
        splat(0.2 + Math.random() * 0.6, 0.2 + Math.random() * 0.6, Math.cos(a) * 900, Math.sin(a) * 900, nextColor(0.8), 0.003)
      }
    }
    let started = false

    const ptr = { x: 0, y: 0, px: 0, py: 0, moved: false, inside: false }
    const onMove = e => {
      const r = canvas.getBoundingClientRect()
      const x = (e.clientX - r.left) / r.width, y = 1 - (e.clientY - r.top) / r.height
      if (!ptr.inside) { ptr.px = x; ptr.py = y }
      ptr.x = x; ptr.y = y; ptr.moved = true; ptr.inside = true
    }
    const onLeave = () => { ptr.inside = false }
    const onDown = () => burst(3)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerleave', onLeave)
    canvas.addEventListener('pointerdown', onDown)
    // rebuild only on real size changes (the observer also fires once on observe)
    const ro = new ResizeObserver(() => {
      const r = canvas.getBoundingClientRect()
      const dpr = targetDpr(1.25)
      if (Math.abs(r.width * dpr - canvas.width) > 2 || Math.abs(r.height * dpr - canvas.height) > 2) { build(); started = false }
    })
    ro.observe(canvas)

    const step = dt => {
      const tv = vel.texel
      P.curl.use()
      gl.uniform2f(P.curl.u.uTexel, ...tv)
      gl.uniform1i(P.curl.u.uVelocity, vel.read.bind(0))
      sim.draw(curlT)

      P.vort.use()
      gl.uniform2f(P.vort.u.uTexel, ...tv)
      gl.uniform1i(P.vort.u.uVelocity, vel.read.bind(0))
      gl.uniform1i(P.vort.u.uCurl, curlT.bind(1))
      gl.uniform1f(P.vort.u.uStrength, curl)
      gl.uniform1f(P.vort.u.uDt, dt)
      sim.draw(vel.write); vel.swap()

      P.div.use()
      gl.uniform2f(P.div.u.uTexel, ...tv)
      gl.uniform1i(P.div.u.uVelocity, vel.read.bind(0))
      sim.draw(divergence)

      P.fade.use()
      gl.uniform1i(P.fade.u.uSource, pressure.read.bind(0))
      gl.uniform1f(P.fade.u.uValue, 0.8)
      sim.draw(pressure.write); pressure.swap()

      P.pressure.use()
      gl.uniform2f(P.pressure.u.uTexel, ...tv)
      gl.uniform1i(P.pressure.u.uDivergence, divergence.bind(1))
      for (let i = 0; i < pressureIterations; i++) {
        gl.uniform1i(P.pressure.u.uPressure, pressure.read.bind(0))
        sim.draw(pressure.write); pressure.swap()
      }

      P.grad.use()
      gl.uniform2f(P.grad.u.uTexel, ...tv)
      gl.uniform1i(P.grad.u.uPressure, pressure.read.bind(0))
      gl.uniform1i(P.grad.u.uVelocity, vel.read.bind(1))
      sim.draw(vel.write); vel.swap()

      P.advect.use()
      gl.uniform2f(P.advect.u.uTexel, ...tv)
      gl.uniform1f(P.advect.u.uDt, dt)
      gl.uniform1i(P.advect.u.uVelocity, vel.read.bind(0))
      gl.uniform1i(P.advect.u.uSource, vel.read.bind(0))
      gl.uniform1f(P.advect.u.uDissipation, 0.2)
      sim.draw(vel.write); vel.swap()

      gl.uniform1i(P.advect.u.uVelocity, vel.read.bind(0))
      gl.uniform1i(P.advect.u.uSource, dye.read.bind(1))
      gl.uniform1f(P.advect.u.uDissipation, inkFade)
      sim.draw(dye.write); dye.swap()
    }

    let raf, last = performance.now(), idle = 0
    const loop = now => {
      raf = requestAnimationFrame(loop)
      if (!visible.current || !sim.ready()) { last = now; return }
      if (!started) { started = true; burst(6) }
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now
      if (ptr.moved && ptr.inside) {
        const dx = ptr.x - ptr.px, dy = ptr.y - ptr.py
        if (dx * dx + dy * dy > 1e-7) splat(ptr.x, ptr.y, dx * 6000, dy * 6000, nextColor(0.3))
        ptr.px = ptr.x; ptr.py = ptr.y; ptr.moved = false; idle = 0
      } else if ((idle += dt) > 2.8) { burst(2); idle = 0 }
      step(dt)
      P.display.use()
      gl.uniform2f(P.display.u.uTexel, ...dye.texel)
      gl.uniform1i(P.display.u.uDye, dye.read.bind(0))
      sim.draw(null)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerleave', onLeave)
      canvas.removeEventListener('pointerdown', onDown)
      sim.dispose()
    }
  }, [key, simResolution, dyeResolution, curl, pressureIterations, inkFade, visible])

  // a fresh canvas per configuration, since dispose() releases the context
  return <canvas key={key} ref={canvasRef} className="fx-canvas" />
}
