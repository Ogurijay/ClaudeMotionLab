import { useRef } from 'react'
import { useShaderCanvas } from '../../hooks/useShaderCanvas'

const FRAG = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uMouse;
uniform sampler2D uText;
out vec4 outColor;

// approximate visible spectrum, t in 0..1 (red → violet)
vec3 spectrum(float t) {
  vec3 c = clamp(vec3(abs(t * 6.0 - 3.0) - 1.0, 2.0 - abs(t * 6.0 - 2.0), 2.0 - abs(t * 6.0 - 4.0)), 0.0, 1.0);
  return c * c;
}

float mask(vec2 uv) { return texture(uText, uv).r; }

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 asp = vec2(uRes.x / uRes.y, 1.0);
  vec2 L = uMouse;
  vec2 toPix = (uv - L) * asp;
  float dist = length(toPix);
  vec2 dir = toPix / max(dist, 1e-4) / asp;

  vec3 col = vec3(0.012, 0.016, 0.03);
  // faint grid
  vec2 grid = abs(fract(uv * asp * 18.0) - 0.5);
  col += 0.018 * smoothstep(0.48, 0.5, max(grid.x, grid.y));

  // dispersion: each wavelength sees the glyphs shifted along the light direction
  float spread = 0.004 + dist * 0.022;
  vec3 disp = vec3(0.0);
  for (int i = 0; i < 9; i++) {
    float t = float(i) / 8.0;
    disp += spectrum(t) * mask(uv - dir * (t - 0.5) * spread);
  }
  col += disp / 2.6;

  // coloured rays thrown away from the light by the glyph edges
  vec3 rays = vec3(0.0);
  float decay = 1.0;
  for (int i = 1; i <= 28; i++) {
    float s = float(i) / 28.0;
    vec2 q = uv - (uv - L) * s * 0.35;
    float m = mask(q);
    rays += spectrum(fract(s * 1.6 + uTime * 0.05)) * m * decay;
    decay *= 0.94;
  }
  float behind = 1.0 - mask(uv);
  col += rays * 0.045 * behind;

  // the light itself
  col += vec3(0.9, 0.95, 1.0) * (exp(-dist * 22.0) * 1.4 + exp(-dist * 4.0) * 0.08);
  outColor = vec4(pow(col, vec3(0.95)), 1.0);
}`

/**
 * Text split by a prism: the cursor is the light source, every wavelength
 * sees the glyphs at a slightly different place, and coloured rays stream
 * away from the letters.
 */
export default function PrismText({ text = 'PRISM', font = '900 1px "Inter Variable", Inter, "Arial Black", sans-serif' }) {
  const light = useRef({ x: 0.5, y: 0.6 })

  const canvasRef = useShaderCanvas({
    fragment: FRAG,
    dprCap: 1.25,
    mouseEase: 1,
    onFrame: ({ gl, uniform, mouse, time }) => {
      // follow the cursor; drift along a slow orbit when it is elsewhere
      const l = light.current
      const tx = mouse.inside ? mouse.tx : 0.5 + Math.cos(time * 0.35) * 0.32
      const ty = mouse.inside ? mouse.ty : 0.55 + Math.sin(time * 0.5) * 0.28
      l.x += (tx - l.x) * 0.06
      l.y += (ty - l.y) * 0.06
      gl.uniform2f(uniform('uMouse'), l.x, l.y)
    },
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
        const size = Math.min(h * 0.42, (w * 0.9) / (text.length * 0.72))
        g.font = font.replace('1px', `${size}px`)
        g.fillText(text, w / 2, h * 0.52)
        return c
      },
    },
  }, [text, font])

  return <canvas ref={canvasRef} className="fx-canvas" />
}
