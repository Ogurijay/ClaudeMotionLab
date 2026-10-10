import { useRef } from 'react'
import { useShaderCanvas } from '../../hooks/useShaderCanvas'
import { idCard } from '../../lib/artwork'

const FRAG = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform sampler2D uContent;   // white line art on black
uniform float uStart;
out vec4 outColor;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 asp = vec2(uRes.x / uRes.y, 1.0);
  // cycle: scan down (0–2.6 s), hold, dissolve (5.6–6.6 s), pause, repeat
  float t = mod(uTime - uStart, 7.5);
  float scanY = 1.0 - smoothstep(0.0, 2.6, t) * 1.1;
  float dissolve = smoothstep(5.6, 6.6, t);

  vec3 col = vec3(0.0, 0.02, 0.035);
  vec2 grid = abs(fract(uv * asp * 24.0) - 0.5);
  col += vec3(0.0, 0.25, 0.3) * 0.12 * smoothstep(0.46, 0.5, max(grid.x, grid.y));

  float revealed = step(scanY, uv.y);
  // hologram: jitter rows, chromatic offset, flicker, scanlines
  float row = floor(uv.y * uRes.y / 3.0);
  float jitter = (hash(vec2(row, floor(uTime * 20.0))) - 0.5) * 0.004 * (1.0 + step(0.97, hash(vec2(floor(uTime * 7.0)))) * 6.0);
  vec2 q = uv + vec2(jitter, 0.0);
  float m = texture(uContent, q).r;
  float mr = texture(uContent, q + vec2(0.003, 0.0)).r;
  float mb = texture(uContent, q - vec2(0.003, 0.0)).r;
  float glow = textureLod(uContent, q, 3.0).r;
  vec3 holo = vec3(mr * 0.3, m * 0.95, mb) * 1.2 + vec3(0.1, 0.8, 1.0) * glow * 0.5;
  holo *= 0.75 + 0.25 * sin(gl_FragCoord.y * 1.6 + uTime * 8.0);
  holo *= 0.9 + 0.1 * hash(vec2(floor(uTime * 30.0)));
  float noise = hash(uv * 400.0 + uTime);
  float alive = revealed * step(dissolve, noise * 0.98);   // dissolve breaks the image into static
  col += holo * alive;

  // scan beam
  float beam = exp(-abs(uv.y - scanY) * 90.0) * step(t, 3.0);
  col += vec3(0.3, 1.0, 1.0) * beam * 1.2;
  col += vec3(0.0, 0.5, 0.6) * exp(-max(uv.y - scanY, 0.0) * 14.0) * 0.15 * step(t, 3.0) * revealed;
  outColor = vec4(col, 1.0);
}`

/**
 * A holographic projection materialising under a scanning beam: line art
 * appears row by row in flickering cyan with chromatic jitter, holds, then
 * dissolves into static. Click to rescan.
 */
export default function HoloScanner() {
  const start = useRef(-1)
  const canvasRef = useShaderCanvas({
    fragment: FRAG,
    textures: { uContent: idCard },
    onFrame: ({ gl, uniform, time }) => {
      if (start.current < 0) start.current = time
      gl.uniform1f(uniform('uStart'), start.current)
    },
    onPointerDown: ({ time }) => { start.current = time },
  })
  return <canvas ref={canvasRef} className="fx-canvas" style={{ cursor: 'pointer' }} />
}
