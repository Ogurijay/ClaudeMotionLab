import { useEffect, useRef } from 'react'
import { createSim } from '../../lib/glsim'
import { useVisibility } from '../../hooks/useVisibility'

const HEAD = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
`

// discrete wave equation: r = height now, g = height one step ago
const WAVE = HEAD + /* glsl */ `
uniform sampler2D uState;
uniform vec2 uTexel;
uniform float uDamping;
void main() {
  vec2 s = texture(uState, vUv).rg;
  float sum = texture(uState, vUv + vec2(uTexel.x, 0.0)).r + texture(uState, vUv - vec2(uTexel.x, 0.0)).r
            + texture(uState, vUv + vec2(0.0, uTexel.y)).r + texture(uState, vUv - vec2(0.0, uTexel.y)).r;
  float next = (sum * 0.5 - s.g) * uDamping;
  o = vec4(next, s.r, 0.0, 1.0);
}`

const DROP = HEAD + /* glsl */ `
uniform sampler2D uState;
uniform vec2 uPoint;
uniform float uRadius;
uniform float uStrength;
uniform float uAspect;
void main() {
  vec2 s = texture(uState, vUv).rg;
  vec2 d = vUv - uPoint;
  d.x *= uAspect;
  float l = length(d) / uRadius;
  if (l < 1.0) s.r += uStrength * (cos(l * 3.14159) * 0.5 + 0.5);
  o = vec4(s, 0.0, 1.0);
}`

const DISPLAY = HEAD + /* glsl */ `
uniform sampler2D uState;
uniform vec2 uTexel;
uniform float uAspect;
uniform float uTime;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

// pool floor: glazed mosaic tiles with grout and a darker accent stripe
vec3 floorColor(vec2 p) {
  vec2 g = p * 9.0;
  vec2 id = floor(g), f = fract(g);
  float grout = smoothstep(0.03, 0.07, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));
  vec3 tile = mix(vec3(0.04, 0.4, 0.5), vec3(0.12, 0.58, 0.64), hash(id));
  tile = mix(tile, vec3(0.02, 0.18, 0.32), step(mod(id.y, 9.0), 0.5) * 0.8);
  tile *= 0.92 + 0.16 * (f.x * (1.0 - f.y));   // glaze sheen across each tile
  return mix(vec3(0.72, 0.8, 0.78), tile, grout);
}

void main() {
  float h = texture(uState, vUv).r;
  float hl = texture(uState, vUv - vec2(uTexel.x, 0.0)).r, hr = texture(uState, vUv + vec2(uTexel.x, 0.0)).r;
  float hb = texture(uState, vUv - vec2(0.0, uTexel.y)).r, ht = texture(uState, vUv + vec2(0.0, uTexel.y)).r;
  vec3 n = normalize(vec3(hl - hr, hb - ht, 0.12));
  vec2 p = vUv * vec2(uAspect, 1.0);

  // refraction of the floor through the surface
  vec3 col = floorColor(p + n.xy * 0.06);
  // caustics: light gathers where the surface is concave
  float lap = hl + hr + hb + ht - 4.0 * h;
  col += vec3(0.85, 1.0, 0.95) * clamp(-lap * 9.0, 0.0, 1.0) * 0.6;
  col *= vec3(0.75, 0.95, 1.0);
  // sky reflection and sun glint
  float fres = pow(1.0 - n.z, 2.0);
  col = mix(col, vec3(0.75, 0.9, 1.0), fres * 0.5);
  vec3 L = normalize(vec3(-0.4, 0.5, 0.75));
  col += pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 120.0) * 1.2;
  col *= 1.0 - 0.25 * length(vUv - 0.5);
  o = vec4(col, 1.0);
}`

/**
 * A tiled pool simulated with the discrete wave equation on the GPU: ripples
 * spread, interfere and bounce off the walls, refracting the floor and
 * focusing light into caustics. Rain falls by itself; the cursor trails
 * ripples and a click drops a stone.
 */
export default function RipplePond({ resolution = 0.5, damping = 0.988, rain = true }) {
  const canvasRef = useRef(null)
  const visible = useVisibility(canvasRef)
  const key = `${resolution}|${damping}|${rain}`

  useEffect(() => {
    const canvas = canvasRef.current
    const sim = createSim(canvas)
    if (!sim) return
    const { gl } = sim
    const P = { wave: sim.program(WAVE), drop: sim.program(DROP), display: sim.program(DISPLAY) }
    let state, aspect = 1

    const build = () => {
      const r = canvas.getBoundingClientRect()
      canvas.width = Math.max(1, Math.round(r.width * Math.min(window.devicePixelRatio, 1.5)))
      canvas.height = Math.max(1, Math.round(r.height * Math.min(window.devicePixelRatio, 1.5)))
      aspect = canvas.width / canvas.height
      state = sim.doubleTarget(Math.max(64, Math.round(r.width * resolution)), Math.max(64, Math.round(r.height * resolution)), gl.LINEAR, 'half')   // half floats are linearly filterable in core WebGL2
    }
    build()

    const drop = (x, y, radius, strength) => {
      P.drop.use()
      gl.uniform1i(P.drop.u.uState, state.read.bind(0))
      gl.uniform2f(P.drop.u.uPoint, x, y)
      gl.uniform1f(P.drop.u.uRadius, radius)
      gl.uniform1f(P.drop.u.uStrength, strength)
      gl.uniform1f(P.drop.u.uAspect, aspect)
      sim.draw(state.write); state.swap()
    }

    const ptr = { x: 0, y: 0, lx: -1, ly: -1, inside: false }
    const toUv = e => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height] }
    const onMove = e => { [ptr.x, ptr.y] = toUv(e); ptr.inside = true }
    const onLeave = () => { ptr.inside = false }
    const onDown = e => { const [x, y] = toUv(e); drop(x, y, 0.06, 1.2) }
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerleave', onLeave)
    canvas.addEventListener('pointerdown', onDown)
    const ro = new ResizeObserver(() => {
      const r = canvas.getBoundingClientRect()
      if (Math.abs(r.width * resolution - state.w) > 2 || Math.abs(r.height * resolution - state.h) > 2) build()
    })
    ro.observe(canvas)

    let raf, nextRain = 0
    const t0 = performance.now()
    const loop = now => {
      raf = requestAnimationFrame(loop)
      if (!visible.current) return
      const t = (now - t0) / 1000
      if (rain && t > nextRain) { drop(Math.random(), Math.random(), 0.012 + Math.random() * 0.015, 0.35); nextRain = t + 0.15 + Math.random() * 0.4 }
      if (ptr.inside && Math.hypot(ptr.x - ptr.lx, ptr.y - ptr.ly) > 0.01) { drop(ptr.x, ptr.y, 0.02, 0.25); ptr.lx = ptr.x; ptr.ly = ptr.y }
      P.wave.use()
      gl.uniform2f(P.wave.u.uTexel, ...state.texel)
      gl.uniform1f(P.wave.u.uDamping, damping)
      for (let i = 0; i < 2; i++) {
        gl.uniform1i(P.wave.u.uState, state.read.bind(0))
        sim.draw(state.write); state.swap()
      }
      P.display.use()
      gl.uniform1i(P.display.u.uState, state.read.bind(0))
      gl.uniform2f(P.display.u.uTexel, ...state.texel)
      gl.uniform1f(P.display.u.uAspect, aspect)
      gl.uniform1f(P.display.u.uTime, t)
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
  }, [key, resolution, damping, rain, visible])

  return <canvas key={key} ref={canvasRef} className="fx-canvas" />
}
