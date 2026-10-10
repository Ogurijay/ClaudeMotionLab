import { useRef } from 'react'
import { useShaderCanvas } from '../../hooks/useShaderCanvas'

const FRAG = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform sampler2D uText;     // white glyphs on black (red channel)
uniform float uStart;
uniform vec3 uInk;
out vec4 outColor;

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 asp = vec2(uRes.x / uRes.y, 1.0);
  vec2 p = uv * asp;

  // xuan paper: warm base, long fibres, fine grain
  float fibres = fbm(vec2(p.x * 3.0, p.y * 40.0)) * 0.5 + fbm(p * vec2(60.0, 6.0)) * 0.5;
  float grain = noise(p * 420.0);
  vec3 paper = vec3(0.95, 0.92, 0.86) - fibres * 0.06 - grain * 0.025;

  // bleed cycle: spread (0–3.5 s), rest, slowly absorb into the paper, repeat
  float t = mod(max(uTime - uStart, 0.0), 10.0);
  float spread = smoothstep(0.0, 3.5, t);
  float absorb = smoothstep(7.5, 9.6, t);

  // the ink front advances through a blurred copy of the glyphs (higher mip = wider reach),
  // its threshold roughened by paper fibres so the edge feathers along them
  float n = fbm(p * 18.0) * 0.6 + fibres * 0.4;
  // a blurred mip is brightest at stroke centres and ~0.5 on the original outline,
  // so lowering the threshold grows each stroke outward from its spine
  float core = textureLod(uText, uv, 2.6).r;
  float halo = textureLod(uText, uv, 4.6 + n * 1.5).r;
  float thCore = mix(0.97, 0.45, spread) + (n - 0.5) * 0.16;
  float thHalo = mix(0.9, 0.24, spread) + (n - 0.5) * 0.25;
  float inkCore = smoothstep(thCore - 0.04, thCore + 0.04, core);
  float inkHalo = smoothstep(thHalo - 0.05, thHalo + 0.08, halo);
  float rim = smoothstep(0.12, 0.0, abs(core - thCore)) * inkCore;   // pigment pools at the wet edge

  float density = max(inkCore * (0.88 + 0.12 * grain), inkHalo * 0.2) + rim * 0.25;
  density *= 0.86 + 0.14 * fibres;
  density *= 1.0 - absorb;
  vec3 col = mix(paper, uInk, clamp(density, 0.0, 1.0));
  col *= 1.0 - 0.18 * length(uv - 0.5);
  outColor = vec4(col, 1.0);
}`

/**
 * Calligraphy that appears the way ink bleeds into xuan paper: strokes soak in
 * from their centres, feather along the paper fibres and pool at the wet edge.
 * Click to drop the ink again.
 */
export default function InkBleed({ text = '墨', caption = '', ink = '#141820', font = '"KaiTi", "STKaiti", "Kaiti SC", serif' }) {
  const start = useRef(-1)

  const canvasRef = useShaderCanvas({
    fragment: FRAG,
    textures: {
      uText: (w, h) => {
        const c = document.createElement('canvas')
        c.width = w; c.height = h
        const g = c.getContext('2d')
        g.fillStyle = '#000'
        g.fillRect(0, 0, w, h)
        g.fillStyle = '#fff'
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        const size = Math.min(h * 0.62, (w * 0.8) / Math.max(1, [...text].length))
        g.font = `${size}px ${font}`
        g.fillText(text, w / 2, caption ? h * 0.44 : h * 0.5)
        if (caption) {
          g.font = `600 ${Math.max(16, h * 0.07)}px ${font}`
          g.fillText(caption, w / 2, h * 0.88)
        }
        return c
      },
    },
    onFrame: ({ gl, uniform, time }) => {
      if (start.current < 0) start.current = time
      gl.uniform1f(uniform('uStart'), start.current)
      const v = parseInt(ink.slice(1), 16)
      gl.uniform3f(uniform('uInk'), ((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255)
    },
    onPointerDown: ({ time }) => { start.current = time },
  }, [text, caption, font])

  return <canvas ref={canvasRef} className="fx-canvas" style={{ cursor: 'pointer' }} />
}
