import { useRef } from 'react'
import { useShaderCanvas } from '../../hooks/useShaderCanvas'
import { neonPoster } from '../../lib/artwork'

const FRAG = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform sampler2D uImage;
uniform float uGlitch;      // 0..1 overall intensity
out vec4 outColor;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float hash1(float x) { return fract(sin(x * 91.7) * 43758.5453); }

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float g = uGlitch;
  float t = floor(uTime * 18.0);                // glitches update in discrete "frames"

  // horizontal slice tearing: random bands shift sideways
  float band = floor(uv.y * mix(8.0, 40.0, hash1(t)));
  float tear = (hash(vec2(band, t)) - 0.5) * step(1.0 - g * 0.6, hash(vec2(band + 3.1, t)));
  uv.x += tear * 0.25 * g;

  // occasional vertical roll
  uv.y = fract(uv.y + step(0.93, hash1(t + 7.0)) * g * 0.08);

  // block corruption: some tiles sample from elsewhere or posterise
  vec2 block = floor(uv * vec2(16.0, 9.0));
  float corrupt = step(1.0 - g * 0.18, hash(block + t));
  vec2 src = mix(uv, uv + (vec2(hash(block * 1.7 + t), hash(block * 2.3 + t)) - 0.5) * 0.2, corrupt);

  // RGB channel split
  float split = 0.004 + g * 0.03 * (0.5 + hash1(t + 2.0));
  vec3 col;
  col.r = texture(uImage, src + vec2(split, 0.0)).r;
  col.g = texture(uImage, src).g;
  col.b = texture(uImage, src - vec2(split, 0.0)).b;
  col = mix(col, floor(col * 3.0) / 3.0 + vec3(0.0, 0.15, 0.2), corrupt * 0.8);

  // scanlines, noise, and a bright interference line
  col *= 0.9 + 0.1 * sin(gl_FragCoord.y * 3.14159);
  col += (hash(gl_FragCoord.xy + uTime) - 0.5) * (0.05 + g * 0.18);
  float line = smoothstep(0.004, 0.0, abs(uv.y - fract(uTime * 0.37)));
  col += line * vec3(0.4, 1.0, 1.0) * (0.2 + g);
  outColor = vec4(col, 1.0);
}`

/**
 * A neon poster suffering from signal corruption: slice tearing, RGB split,
 * block corruption, rolling and noise. Idle it twitches now and then; moving
 * the cursor fast drives the glitch harder. Click for a full burst.
 */
export default function GlitchImage({ title = 'GLITCH', idle = 0.12 }) {
  const state = useRef({ g: 0, burst: 0, last: [0.5, 0.5], next: 1 })

  const canvasRef = useShaderCanvas({
    fragment: FRAG,
    mouseEase: 1,
    textures: { uImage: (w, h) => neonPoster(w, h, title) },
    onFrame: ({ gl, uniform, mouse, time }) => {
      const s = state.current
      const speed = Math.hypot(mouse.tx - s.last[0], mouse.ty - s.last[1])
      s.last = [mouse.tx, mouse.ty]
      if (time > s.next) { s.burst = Math.max(s.burst, 0.5 + Math.random() * 0.4); s.next = time + 1.2 + Math.random() * 2.5 }
      s.burst *= 0.88
      const target = Math.min(1, idle + s.burst + (mouse.inside ? speed * 25 : 0))
      s.g += (target - s.g) * 0.3
      gl.uniform1f(uniform('uGlitch'), s.g)
    },
    onPointerDown: () => { state.current.burst = 1.4 },
  }, [title])

  return <canvas ref={canvasRef} className="fx-canvas" />
}
