import { useRef } from 'react'
import { useShaderCanvas } from '../../hooks/useShaderCanvas'
import { landscape } from '../../lib/artwork'

const FRAG = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uMouse;
uniform sampler2D uImage;
uniform float uReveal;      // 0 = coarse mosaic, 1 = full resolution
uniform float uBlock;       // largest block size in pixels
out vec4 outColor;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = frag / uRes;
  vec2 asp = vec2(uRes.x / uRes.y, 1.0);
  // resolve from the cursor outward: each coarse block gets its own delay
  vec2 coarse = floor(frag / uBlock);
  vec2 centre = (coarse + 0.5) * uBlock / uRes;
  float dist = length((centre - uMouse) * asp);
  float delay = hash(coarse) * 0.45 + dist * 0.55;
  float local = clamp((uReveal * 1.6 - delay) / 0.35, 0.0, 1.0);

  // pick a block size between uBlock and 1px in power-of-two steps
  float level = floor((1.0 - local) * 4.0 + 0.0001);       // 4 → coarse … 0 → sharp
  float size = level >= 4.0 ? uBlock : level <= 0.0 ? 1.0 : uBlock / pow(2.0, 4.0 - level);
  vec2 q = (floor(frag / size) + 0.5) * size / uRes;
  vec3 col = texture(uImage, q).rgb;
  // blocks flash light as they snap to a finer level
  float edge = fract((1.0 - local) * 4.0);
  col += vec3(1.0) * smoothstep(0.92, 1.0, edge) * 0.25 * step(0.001, local) * step(local, 0.999);
  // thin grid lines on the coarse blocks
  vec2 cell = fract(frag / size);
  col *= mix(1.0, 0.85, step(12.0, size) * max(step(cell.x, 1.0 / size), step(cell.y, 1.0 / size)));
  outColor = vec4(col, 1.0);
}`

/**
 * A painting that dissolves between a chunky mosaic and full resolution.
 * Hovering resolves it block by block, spreading out from the cursor;
 * leaving lets it crumble back into pixels.
 */
export default function PixelDissolve({ block = 48 }) {
  const reveal = useRef(0)
  const canvasRef = useShaderCanvas({
    fragment: FRAG,
    mouseEase: 0.25,
    textures: { uImage: landscape },
    onFrame: ({ gl, uniform, mouse }) => {
      reveal.current += ((mouse.inside ? 1 : 0) - reveal.current) * (mouse.inside ? 0.025 : 0.04)
      gl.uniform1f(uniform('uReveal'), reveal.current)
      gl.uniform1f(uniform('uBlock'), block * Math.min(window.devicePixelRatio, 1.5))
    },
  })
  return <canvas ref={canvasRef} className="fx-canvas" />
}
