import { useRef, useState } from 'react'
import { useShaderCanvas } from '../../hooks/useShaderCanvas'

const FRAG = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform sampler2D uBg;
uniform vec2 uLens;        // lens centre (uv)
uniform float uShape;      // 0 = sphere, 1 = pill (morphs smoothly)
uniform float uSize;
out vec4 outColor;

float sdRoundBox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }

// signed distance to the lens outline, blending sphere → pill
float lensSDF(vec2 p) {
  float circle = length(p) - uSize;
  float pill = sdRoundBox(p, vec2(uSize * 1.7, uSize * 0.72), uSize * 0.72);
  return mix(circle, pill, uShape);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 asp = vec2(uRes.x / uRes.y, 1.0);
  vec2 p = (uv - uLens) * asp;
  float d = lensSDF(p);
  vec3 bg = texture(uBg, uv).rgb;

  // soft drop shadow beneath the glass
  float sh = lensSDF(p + vec2(-0.012, 0.03));
  bg *= 1.0 - 0.28 * smoothstep(0.06, -0.02, sh) * smoothstep(-0.03, 0.0, d);

  if (d > 0.0) { outColor = vec4(bg, 1.0); return; }

  // surface normal from the SDF gradient: steep at the rim, flat in the middle
  vec2 e = vec2(0.0015, 0.0);
  vec2 g = normalize(vec2(lensSDF(p + e.xy) - lensSDF(p - e.xy), lensSDF(p + e.yx) - lensSDF(p - e.yx)));
  float inside = -d;                                   // distance from the rim
  float bevel = mix(uSize, uSize * 0.55, uShape);
  float k = clamp(1.0 - inside / bevel, 0.0, 1.0);
  float slope = k * k * (3.0 - 2.0 * k);
  vec3 n = normalize(vec3(g * slope * 1.6, 1.0));

  // refraction: bend the view toward the centre, magnify, split colours at the rim
  vec2 base = uLens + (uv - uLens) * 0.86;
  vec2 bend = -n.xy * 0.09 / asp;
  float disp = 0.08 * slope;
  vec3 col;
  col.r = texture(uBg, base + bend * (1.0 - disp)).r;
  col.g = texture(uBg, base + bend).g;
  col.b = texture(uBg, base + bend * (1.0 + disp)).b;

  // glass tint, fresnel rim, specular highlights, inner caustic on the far side
  col *= vec3(0.97, 0.99, 1.0);
  float fres = pow(1.0 - n.z, 2.0);
  col += fres * 0.16;
  vec3 L = normalize(vec3(-0.5, 0.7, 0.6));
  col += pow(max(dot(reflect(-L, n), vec3(0, 0, 1)), 0.0), 60.0) * 0.9;
  col += smoothstep(0.004, 0.0, abs(d + 0.003)) * 0.35;              // thin bright edge
  col += vec3(1.0, 0.95, 0.85) * smoothstep(0.6, 1.0, dot(-g, normalize(vec2(0.5, -0.7)))) * slope * 0.2;
  outColor = vec4(col, 1.0);
}`

// a bold editorial poster for the lens to distort
function poster(w, h) {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const g = c.getContext('2d')
  g.fillStyle = '#efece6'
  g.fillRect(0, 0, w, h)
  g.strokeStyle = 'rgba(0,0,0,0.08)'
  g.lineWidth = 1
  const step = Math.round(h / 18)
  for (let x = 0; x < w; x += step) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke() }
  for (let y = 0; y < h; y += step) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke() }
  const blobs = [['#2563eb', 0.78, 0.3, 0.16], ['#f97316', 0.18, 0.78, 0.12], ['#ec4899', 0.62, 0.82, 0.07], ['#16a34a', 0.9, 0.75, 0.05]]
  for (const [col, x, y, r] of blobs) { g.fillStyle = col; g.beginPath(); g.arc(x * w, y * h, r * h * 1.6, 0, Math.PI * 2); g.fill() }
  g.fillStyle = '#111'
  g.textBaseline = 'alphabetic'
  const big = Math.min(h * 0.27, w * 0.16)
  g.font = `900 ${big}px "Inter Variable", Inter, "Arial Black", sans-serif`
  g.fillText('LIQUID', w * 0.06, h * 0.42)
  g.fillText('GLASS', w * 0.06, h * 0.72)
  g.font = `500 ${Math.max(11, h * 0.022)}px "JetBrains Mono", monospace`
  g.fillText('GL-01 · REFRACTION · DISPERSION · FRESNEL', w * 0.065, h * 0.86)
  g.fillText('CLAUDE MOTION LAB', w * 0.75, h * 0.08)
  return c
}

/**
 * A glass lens that glides after the cursor over an editorial poster: SDF-based
 * surface normals, magnifying refraction, chromatic dispersion at the rim,
 * fresnel and specular highlights. Click to morph between sphere and pill.
 */
export default function RefractionLens({ shape = 'pill', size = 0.16 }) {
  const [pill, setPill] = useState(shape === 'pill')
  const pillRef = useRef(pill)
  pillRef.current = pill
  const state = useRef({ x: 0.5, y: 0.5, vx: 0, vy: 0, shape: pill ? 1 : 0 })

  const canvasRef = useShaderCanvas({
    fragment: FRAG,
    dprCap: 1.25,
    mouseEase: 1,
    textures: { uBg: poster },
    onFrame: ({ gl, uniform, mouse }) => {
      const s = state.current
      const tx = mouse.inside ? mouse.tx : 0.5 + Math.sin(performance.now() / 1600) * 0.22
      const ty = mouse.inside ? mouse.ty : 0.5 + Math.cos(performance.now() / 2100) * 0.12
      // spring so the glass has a little weight
      s.vx = (s.vx + (tx - s.x) * 0.06) * 0.8
      s.vy = (s.vy + (ty - s.y) * 0.06) * 0.8
      s.x += s.vx
      s.y += s.vy
      s.shape += ((pillRef.current ? 1 : 0) - s.shape) * 0.1
      gl.uniform2f(uniform('uLens'), s.x, s.y)
      gl.uniform1f(uniform('uShape'), s.shape)
      gl.uniform1f(uniform('uSize'), size)
    },
    onPointerDown: () => setPill(v => !v),
  })

  return <canvas ref={canvasRef} className="fx-canvas" style={{ cursor: 'none' }} />
}
