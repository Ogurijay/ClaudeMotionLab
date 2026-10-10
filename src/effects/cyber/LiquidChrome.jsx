import { useRef } from 'react'
import { useShaderCanvas } from '../../hooks/useShaderCanvas'

const FRAG = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uMouse;
uniform vec4 uRipples[8];   // xy = uv position, z = start time
uniform float uTint;        // 0 = pure chrome, 1 = full iridescence
out vec4 outColor;

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(dot(hash2(i), f), dot(hash2(i + vec2(1, 0)), f - vec2(1, 0)), u.x),
             mix(dot(hash2(i + vec2(0, 1)), f - vec2(0, 1)), dot(hash2(i + vec2(1, 1)), f - vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = m * p; a *= 0.45; }
  return v;
}
vec2 toP(vec2 uv) { return (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0) * 1.05; }

// height field: domain-warped fbm + cursor bulge + click ripples
float field(vec2 p) {
  float t = uTime * 0.12;
  vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(p + 2.2 * q + vec2(1.7, 9.2) + t * 0.7), fbm(p + 2.2 * q + vec2(8.3, 2.8) - t * 0.5));
  float h = fbm(p + 1.8 * r) * 1.2;
  float d = length(p - toP(uMouse));
  h += 0.4 * exp(-d * d * 14.0);
  for (int i = 0; i < 8; i++) {
    vec4 R = uRipples[i];
    float age = uTime - R.z;
    if (age < 0.0 || age > 5.0) continue;
    float dd = length(p - toP(R.xy));
    float front = age * 0.7;
    h += 0.12 * sin((dd - front) * 30.0) * exp(-abs(dd - front) * 7.0) * exp(-age * 0.9);
  }
  return h;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = toP(uv);
  float e = 1.05 / uRes.y * 2.0;
  float h = field(p);
  float hx = field(p + vec2(e, 0.0));
  float hy = field(p + vec2(0.0, e));
  vec3 n = normalize(vec3(-(hx - h) / e * 0.42, -(hy - h) / e * 0.42, 1.0));
  vec3 v = vec3(0.0, 0.0, 1.0);
  vec3 r = reflect(-v, n);

  // fake studio environment: dark floor, bright softbox horizon, rim strip
  float band = r.y * 0.5 + 0.5;
  vec3 env = mix(vec3(0.02, 0.02, 0.035), vec3(0.88, 0.9, 0.95), smoothstep(0.38, 0.78, band));
  env += smoothstep(0.93, 1.0, band) * 0.9;
  env += smoothstep(0.1, 0.0, abs(r.x - 0.55)) * 0.35;
  env *= 0.55 + 0.45 * smoothstep(-0.6, 0.6, r.x);

  vec3 irid = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + h * 1.4 + dot(n.xy, vec2(0.6, 0.4)) + uTime * 0.02));
  float fres = pow(1.0 - max(dot(n, v), 0.0), 2.0);
  vec3 col = env * mix(vec3(1.0), irid, uTint * (0.45 + 0.4 * fres));
  vec3 L = normalize(vec3(-0.4, 0.6, 0.7));
  col += pow(max(dot(reflect(-L, n), v), 0.0), 60.0) * 1.2;
  col += irid * fres * 0.35 * uTint;
  col *= 1.0 - 0.38 * length(uv - 0.5);
  outColor = vec4(pow(col, vec3(0.92)), 1.0);
}`

/**
 * Full-bleed liquid-metal surface rendered with a single fragment shader.
 * Hover bulges the metal; click sends out a ripple.
 */
export default function LiquidChrome({ speed = 1, tint = 0.8, className = '' }) {
  const ripples = useRef(new Float32Array(32).fill(-100)) // 8 × (x, y, startTime, unused)
  const rippleIdx = useRef(0)

  const canvasRef = useShaderCanvas({
    fragment: FRAG,
    dprCap: 1.0,
    speed,
    onFrame: ({ gl, uniform }) => {
      gl.uniform4fv(uniform('uRipples'), ripples.current)
      gl.uniform1f(uniform('uTint'), tint)
    },
    onPointerDown: ({ time }, [x, y]) => {
      ripples.current.set([x, y, time, 0], rippleIdx.current * 4)
      rippleIdx.current = (rippleIdx.current + 1) % 8
    },
  })

  return <canvas ref={canvasRef} className={`fx-canvas ${className}`} />
}
