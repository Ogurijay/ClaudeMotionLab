import { useShaderCanvas } from '../../hooks/useShaderCanvas'

const FRAG = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uMouse;
uniform float uScroll;
out vec4 outColor;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.1; a *= 0.5; } return v; }

// one aurora curtain: a wavy base line with vertical rays rising from it
vec3 curtain(vec2 p, float t, float offset, vec3 low, vec3 high) {
  float base = 0.52 + offset + 0.09 * sin(p.x * 1.3 + t * 0.25 + offset * 10.0) + 0.05 * fbm(vec2(p.x * 1.5 + t * 0.1, offset * 7.0));
  float d = p.y - base;
  if (d < -0.02) return vec3(0.0);
  float rays = pow(fbm(vec2(p.x * 9.0 + t * 0.35 + offset * 30.0, t * 0.08)), 2.2) * 2.4;
  float fall = exp(-max(d, 0.0) * mix(3.0, 7.0, fbm(vec2(p.x * 2.0, t * 0.1)))) * smoothstep(-0.02, 0.02, d);
  vec3 col = mix(low, high, smoothstep(0.0, 0.25, d));
  return col * rays * fall;
}

vec3 sky(vec2 p, float t) {
  vec3 col = mix(vec3(0.01, 0.02, 0.05), vec3(0.03, 0.06, 0.12), smoothstep(1.0, 0.3, p.y));
  vec2 sg = floor(p * vec2(260.0, 160.0));
  col += step(0.996, hash(sg)) * (0.5 + 0.5 * sin(uTime * 2.0 + hash(sg) * 50.0)) * 0.8;
  col += curtain(p, t, 0.0, vec3(0.1, 1.0, 0.55), vec3(0.55, 0.25, 0.9));
  col += curtain(p + vec2(0.7, 0.0), t * 1.2, 0.08, vec3(0.05, 0.8, 0.6), vec3(0.2, 0.4, 1.0)) * 0.7;
  col += curtain(p + vec2(-1.3, 0.0), t * 0.8, -0.05, vec3(0.3, 1.0, 0.4), vec3(0.9, 0.3, 0.6)) * 0.45;
  return col;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float asp = uRes.x / uRes.y;
  vec2 par = (uMouse - 0.5) * vec2(0.08, 0.04);
  float t = uTime + uScroll * 40.0;
  vec2 p = vec2(uv.x * asp, uv.y) + par;
  float horizon = 0.3;

  vec3 col;
  if (uv.y > horizon) col = sky(p, t);
  else {
    // the lake mirrors the sky, broken up by gentle ripples
    float depth = horizon - uv.y;
    vec2 rp = vec2(p.x + sin(uv.y * 160.0 + uTime * 1.5) * 0.004 * (1.0 + depth * 6.0), horizon + depth);
    col = sky(rp, t) * 0.55 * (1.0 - depth * 1.2);
  }
  // mountain silhouette and shoreline
  float ridge = horizon + 0.06 + 0.07 * fbm(vec2(p.x * 2.2, 3.0)) + 0.05 * fbm(vec2(p.x * 6.0, 9.0));
  float mountain = step(uv.y, ridge) * step(horizon, uv.y);
  col = mix(col, vec3(0.008, 0.012, 0.02), mountain);
  float mirror = step(uv.y, horizon) * step(horizon - (ridge - horizon) * 0.8, uv.y);
  col = mix(col, vec3(0.01, 0.015, 0.025), mirror * 0.85);
  outColor = vec4(pow(col, vec3(0.9)), 1.0);
}`

/**
 * Northern lights over a mountain lake: layered curtains of rising rays, a
 * twinkling star field and a rippled reflection. The curtains drift with the
 * page scroll and shift with the cursor.
 */
export default function AuroraSky({ speed = 1 }) {
  const canvasRef = useShaderCanvas({
    fragment: FRAG,
    dprCap: 1.0,
    speed,
    mouseEase: 0.03,
    // scroll offset only needs to drift the curtains; avoid reading layout (scrollHeight) every frame
    onFrame: ({ gl, uniform }) => gl.uniform1f(uniform('uScroll'), window.scrollY / 40000),
  })
  return <canvas ref={canvasRef} className="fx-canvas" />
}
