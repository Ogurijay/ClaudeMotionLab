import { useRef, useState } from 'react'
import { useShaderCanvas } from '../../hooks/useShaderCanvas'
import './DitherLens.css'

const PALETTES = ['gameboy', 'amber', 'paper', 'rgb']

const FRAG = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uMouse;
uniform float uPixel;     // dither block size in device pixels
uniform float uLens;      // 0..1 lens visibility
uniform float uLensR;     // lens radius (fraction of height)
uniform int uPalette;
out vec4 outColor;

float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
float noise(float x) { float i = floor(x), f = fract(x); return mix(hash(vec2(i)), hash(vec2(i + 1.0)), f * f * (3.0 - 2.0 * f)); }
float ridge(float x) {
  return noise(x) * 0.6 + noise(x * 2.3 + 7.0) * 0.28 + noise(x * 5.1 + 3.0) * 0.12;
}

// synthwave sunset: gradient sky, striped sun, layered mountains, scrolling perspective grid
vec3 scene(vec2 uv) {
  vec2 p = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  float horizon = -0.06;
  vec3 col;
  if (p.y > horizon) {
    float t = clamp((p.y - horizon) / 0.56, 0.0, 1.0);
    col = mix(vec3(1.0, 0.5, 0.28), vec3(0.42, 0.1, 0.5), smoothstep(0.0, 0.55, t));
    col = mix(col, vec3(0.04, 0.02, 0.12), smoothstep(0.45, 1.0, t));
    // stars
    vec2 sg = floor(p * 90.0);
    float star = step(0.992, hash(sg)) * smoothstep(0.3, 0.9, t) * (0.6 + 0.4 * sin(uTime * 3.0 + hash(sg + 1.0) * 30.0));
    col += star;
    // sun with stripes cut into its lower half
    vec2 sc = vec2(0.0, horizon + 0.19);
    float r = 0.21;
    float d = length(p - sc);
    float below = clamp((sc.y + 0.02 - p.y) / r, 0.0, 1.0);
    float gap = step(fract((p.y - horizon) * 26.0 + uTime * 0.4), below * 0.55);
    vec3 sunCol = mix(vec3(1.0, 0.95, 0.45), vec3(1.0, 0.25, 0.5), clamp((sc.y + r - p.y) / (2.0 * r), 0.0, 1.0));
    col = mix(col, sunCol, step(d, r) * (1.0 - gap));
    col += vec3(1.0, 0.4, 0.5) * 0.25 * exp(-max(d - r, 0.0) * 9.0);
    // mountains (far, near)
    float far = horizon + 0.07 + ridge(p.x * 3.0 + 11.0) * 0.12;
    float near = horizon + 0.02 + ridge(p.x * 4.5 + 2.0) * 0.08;
    if (p.y < far) col = mix(vec3(0.22, 0.06, 0.32), vec3(0.4, 0.12, 0.45), (far - p.y) * 4.0);
    if (p.y < near) col = vec3(0.09, 0.03, 0.16) + vec3(0.9, 0.3, 0.6) * smoothstep(0.012, 0.0, near - p.y) * 0.6;
  } else {
    float z = 0.12 / (horizon - p.y + 0.002);
    float x = p.x * z;
    float gz = abs(fract(z * 0.9 - uTime * 0.9) - 0.5);
    float gx = abs(fract(x * 1.4) - 0.5);
    float w = 0.04 * z;
    float line = max(smoothstep(w, 0.0, gz * 2.0), smoothstep(w * 0.9, 0.0, gx * 2.0));
    float fade = exp(-z * 0.12);
    col = vec3(0.05, 0.01, 0.1) + vec3(1.0, 0.2, 0.75) * line * fade;
    col += vec3(1.0, 0.45, 0.4) * 0.35 * exp(-abs(p.x) * 6.0) * smoothstep(0.25, 0.0, horizon - p.y) * (0.7 + 0.3 * sin(z * 6.0 - uTime * 4.0));
  }
  return col;
}

int bayer8(ivec2 c) {
  int x = c.x & 7, y = c.y & 7, z = x ^ y;
  return ((z & 1) << 5) | ((y & 1) << 4) | ((z & 2) << 2) | ((y & 2) << 1) | ((z & 4) >> 1) | ((y & 4) >> 2);
}

vec3 pal4(int i, vec3 a, vec3 b, vec3 c, vec3 d) { return i == 0 ? a : i == 1 ? b : i == 2 ? c : d; }

vec3 dither(vec3 col, ivec2 cell) {
  float th = (float(bayer8(cell)) + 0.5) / 64.0;
  if (uPalette == 3) return floor(col + th);                       // 1-bit per channel: 8 colours
  float l = pow(dot(col, vec3(0.299, 0.587, 0.114)), 0.85);
  if (uPalette == 2) return mix(vec3(0.07, 0.07, 0.09), vec3(0.95, 0.93, 0.87), floor(l * 1.3 + th));
  int i = int(clamp(floor(l * 3.0 + th), 0.0, 3.0));
  if (uPalette == 0) return pal4(i, vec3(0.06, 0.22, 0.06), vec3(0.19, 0.38, 0.19), vec3(0.55, 0.67, 0.06), vec3(0.61, 0.74, 0.06));
  return pal4(i, vec3(0.1, 0.05, 0.0), vec3(0.48, 0.25, 0.0), vec3(1.0, 0.69, 0.0), vec3(1.0, 0.86, 0.5));
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = frag / uRes;
  ivec2 cell = ivec2(floor(frag / uPixel));
  vec2 quv = (vec2(cell) + 0.5) * uPixel / uRes;
  vec3 col = dither(scene(quv), cell);

  // lens: full-colour, full-resolution, slightly magnified view under the cursor
  vec2 asp = vec2(uRes.x / uRes.y, 1.0);
  float d = length((uv - uMouse) * asp);
  float R = uLensR * uLens;
  if (R > 0.001) {
    vec3 clear = scene(uMouse + (uv - uMouse) * 0.72);
    float inside = smoothstep(R, R - 0.004, d);
    col = mix(col, clear, inside);
    col = mix(col, vec3(1.0), smoothstep(0.006, 0.0, abs(d - R)) * uLens);  // rim
    col *= 1.0 - 0.35 * smoothstep(R + 0.03, R, d) * (1.0 - inside) * uLens; // drop shadow
  }
  outColor = vec4(col, 1.0);
}`

/**
 * Ordered (Bayer 8×8) dithering over a procedural synthwave scene, quantised to
 * retro palettes. A lens under the cursor reveals the full-colour image.
 * Click to cycle palettes.
 */
export default function DitherLens({ palette = 'gameboy', pixelSize = 5, lensRadius = 0.2, speed = 1 }) {
  const [paletteIdx, setPaletteIdx] = useState(Math.max(0, PALETTES.indexOf(palette)))
  const paletteRef = useRef(paletteIdx)
  paletteRef.current = paletteIdx
  const lens = useRef(0)

  const canvasRef = useShaderCanvas({
    fragment: FRAG,
    speed,
    mouseEase: 0.18,
    onFrame: ({ gl, uniform, mouse }) => {
      lens.current += ((mouse.inside ? 1 : 0) - lens.current) * 0.12
      gl.uniform1f(uniform('uPixel'), pixelSize * Math.min(window.devicePixelRatio, 1.5))
      gl.uniform1f(uniform('uLens'), lens.current)
      gl.uniform1f(uniform('uLensR'), lensRadius)
      gl.uniform1i(uniform('uPalette'), paletteRef.current)
    },
    onPointerDown: () => setPaletteIdx(i => (i + 1) % PALETTES.length),
  })

  return (
    <div className="dither">
      <canvas ref={canvasRef} className="fx-canvas" />
      <div className="dither__hud">
        {PALETTES.map((p, i) => <span key={p} className={i === paletteIdx ? 'is-active' : ''}>{p}</span>)}
      </div>
    </div>
  )
}
