import { useRef } from 'react'
import { useShaderCanvas } from '../../hooks/useShaderCanvas'

const FRAG = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uMouse;
uniform sampler2D uOcc;     // occluders (white = solid)
uniform float uDensity;
out vec4 outColor;

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

// emitted light before occlusion: a hot sun disc plus a wide warm glow
float source(vec2 uv, vec2 L, vec2 asp) {
  float d = length((uv - L) * asp);
  return smoothstep(0.07, 0.05, d) * 3.0 + exp(-d * 5.0) * 0.6 + exp(-d * 1.4) * 0.08;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 asp = vec2(uRes.x / uRes.y, 1.0);
  vec2 L = uMouse;

  // screen-space light scattering: march toward the light, collecting unblocked light
  const int N = 72;
  vec2 delta = (uv - L) * uDensity / float(N);
  vec2 q = uv;
  float jitter = hash(gl_FragCoord.xy + fract(uTime)) ;
  q -= delta * jitter;
  float illum = 0.0, decay = 1.0;
  for (int i = 0; i < N; i++) {
    q -= delta;
    float lit = source(q, L, asp) * (1.0 - texture(uOcc, q).r);
    illum += lit * decay;
    decay *= 0.968;
  }
  illum /= float(N) * 0.32;

  float occ = texture(uOcc, uv).r;
  vec3 sky = mix(vec3(0.05, 0.03, 0.06), vec3(0.16, 0.09, 0.1), uv.y);
  vec3 lightCol = vec3(1.0, 0.82, 0.55);
  vec3 col = sky + lightCol * illum * 1.05;
  col += lightCol * source(uv, L, asp) * (1.0 - occ) * 0.6;

  // floating dust catches the beams
  vec2 dg = uv * asp * 90.0 + vec2(0.0, uTime * 1.5);
  float dust = step(0.996, hash(floor(dg))) * smoothstep(0.5, 0.1, length(fract(dg) - 0.5));
  col += dust * illum * 1.6;

  // occluders: dark silhouettes with a rim lit from the side facing the light
  vec2 e = 2.0 / uRes;
  vec2 grad = vec2(texture(uOcc, uv + vec2(e.x, 0)).r - texture(uOcc, uv - vec2(e.x, 0)).r,
                   texture(uOcc, uv + vec2(0, e.y)).r - texture(uOcc, uv - vec2(0, e.y)).r);
  vec2 toL = normalize((L - uv) * asp);
  float rim = clamp(dot(-grad * 4.0, toL), 0.0, 1.0);
  vec3 solid = vec3(0.025, 0.02, 0.03) + lightCol * rim * 0.9;
  col = mix(col, solid, occ);
  col = col / (1.0 + col * 0.35);   // gentle tone map
  outColor = vec4(pow(col, vec3(0.9)), 1.0);
}`

/**
 * Volumetric light: a sun under the cursor shines through cut-out lettering
 * and shapes, throwing crepuscular rays through dusty air.
 */
export default function GodRays({ text = 'LIGHT', density = 0.85 }) {
  const light = useRef({ x: 0.5, y: 0.6 })

  const canvasRef = useShaderCanvas({
    fragment: FRAG,
    dprCap: 1.0,
    mouseEase: 1,
    textures: {
      uOcc: (w, h) => {
        const c = document.createElement('canvas')
        c.width = w; c.height = h
        const g = c.getContext('2d')
        g.fillStyle = '#000'
        g.fillRect(0, 0, w, h)
        g.fillStyle = '#fff'
        g.strokeStyle = '#fff'
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        g.font = `900 ${Math.min(h * 0.4, (w * 0.85) / (text.length * 0.7))}px "Inter Variable", Inter, "Arial Black", sans-serif`
        g.fillText(text, w / 2, h * 0.5)
        // a few rings and bars for extra light shafts
        g.lineWidth = h * 0.012
        for (const [x, y, r] of [[0.14, 0.24, 0.09], [0.86, 0.76, 0.12], [0.88, 0.2, 0.05]]) {
          g.beginPath(); g.arc(x * w, y * h, r * h, 0, Math.PI * 2); g.stroke()
        }
        for (let i = 0; i < 7; i++) g.fillRect(w * (0.06 + i * 0.022), h * 0.84, w * 0.01, h * 0.1)
        return c
      },
    },
    onFrame: ({ gl, uniform, mouse, time }) => {
      // follow the cursor; drift along a slow orbit when it is elsewhere
      const l = light.current
      const tx = mouse.inside ? mouse.tx : 0.5 + Math.cos(time * 0.35) * 0.32
      const ty = mouse.inside ? mouse.ty : 0.55 + Math.sin(time * 0.5) * 0.28
      l.x += (tx - l.x) * 0.06
      l.y += (ty - l.y) * 0.06
      gl.uniform2f(uniform('uMouse'), l.x, l.y)
      gl.uniform1f(uniform('uDensity'), density)
    },
  }, [text])

  return <canvas ref={canvasRef} className="fx-canvas" />
}
