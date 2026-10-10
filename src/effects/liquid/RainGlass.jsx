import { useRef } from 'react'
import { useShaderCanvas } from '../../hooks/useShaderCanvas'

const TRAIL = 32

const FRAG = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uTrail[${TRAIL}];   // xy = uv, z = time the point was wiped
uniform float uRain;
out vec4 outColor;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 hash2(vec2 p) { return vec2(hash(p), hash(p + 17.31)); }

// night city bokeh; blur widens every light analytically instead of sampling
vec3 city(vec2 uv, float blur) {
  vec2 asp = vec2(uRes.x / uRes.y, 1.0);
  vec3 col = mix(vec3(0.02, 0.03, 0.07), vec3(0.09, 0.05, 0.12), smoothstep(0.9, 0.1, uv.y));
  col += vec3(0.25, 0.12, 0.05) * smoothstep(0.45, 0.0, uv.y) * 0.5;
  for (int layer = 0; layer < 3; layer++) {
    float fl = float(layer);
    float scale = 6.0 + fl * 5.0;
    vec2 g = uv * asp * scale + vec2(fl * 13.7, fl * 4.1);
    vec2 id0 = floor(g);
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      vec2 id = id0 + vec2(i, j);
      float n = hash(id + fl * 7.0);
      if (n < 0.35) continue;
      vec2 c = id + hash2(id + fl);
      float yb = (c.y / scale) / asp.y;
      if (yb > 0.7 + 0.1 * fl) continue;                       // lights live in the lower part (streets, windows)
      float r = (0.08 + 0.16 * hash(id + 3.0)) + blur * (0.25 + 0.1 * fl);
      float d = length(g - c);
      float soft = 0.02 + blur * 0.35;
      float disc = smoothstep(r, r - soft, d);
      vec3 tint = n > 0.85 ? vec3(1.0, 0.25, 0.2) : n > 0.7 ? vec3(0.3, 0.75, 1.0) : n > 0.55 ? vec3(1.0, 0.95, 0.85) : vec3(1.0, 0.62, 0.25);
      float energy = 1.0 / (1.0 + blur * 2.2);                  // wider (blurrier) discs get dimmer
      col += tint * disc * energy * (0.55 + 0.3 * fl) * (0.85 + 0.15 * sin(uTime * 0.5 + n * 40.0));
    }
  }
  return col;
}

// static droplets clinging to the glass, fading in and out
vec3 beads(vec2 uv) {
  vec2 asp = vec2(uRes.x / uRes.y, 1.0);
  vec2 g = uv * asp * 34.0;
  vec2 id = floor(g), f = fract(g) - 0.5;
  float n = hash(id);
  vec2 p = (hash2(id + 2.0) - 0.5) * 0.6;
  float r = 0.1 + 0.2 * hash(id + 5.0);
  float life = fract(uTime * 0.04 + n * 3.0);
  float vis = step(0.5, n) * smoothstep(0.0, 0.08, life) * smoothstep(1.0, 0.85, life) * uRain;
  vec2 d = (f - p) / r;
  float l = length(d);
  float m = smoothstep(1.0, 0.75, l) * vis;
  return vec3(d * sqrt(max(0.0, 1.0 - l * l)) * m, m);
}

// big drops sliding down in columns, leaving wet trails dotted with tiny droplets
vec4 runners(vec2 uv, float scale, float seed) {
  vec2 asp = vec2(uRes.x / uRes.y, 1.0);
  vec2 cell = vec2(1.0, 3.5);
  vec2 g = uv * asp * scale / cell;
  vec2 id = floor(g), f = fract(g);
  float n = hash(id + seed);
  if (n < 0.45) return vec4(0.0);
  float speed = 0.06 + 0.12 * hash(id + seed + 1.0);
  float t = fract(uTime * speed + n * 5.0);
  float y = 1.0 - t * t * (1.6 - 0.6 * t);                      // accelerating slide
  float x = 0.5 + 0.18 * sin(f.y * 9.0 + n * 30.0);
  vec2 dp = (f - vec2(x, y)) * cell;
  float r = 0.13 + 0.07 * n;
  float l = length(dp * vec2(1.0, 0.85)) / r;
  float m = smoothstep(1.0, 0.7, l);
  vec2 off = dp / r * sqrt(max(0.0, 1.0 - l * l)) * m;
  // trail above the drop
  float above = step(y, f.y);
  float trail = above * smoothstep(0.09, 0.0, abs(f.x - x) * cell.x) * smoothstep(1.0, y, f.y);
  vec2 td = vec2((f.x - x) * cell.x, (fract(f.y * 14.0) - 0.5) * cell.y / 14.0);
  float tl = length(td) / 0.035;
  float tm = smoothstep(1.0, 0.6, tl) * trail * step(0.4, hash(vec2(id.x, floor(f.y * 14.0)) + seed));
  off += td / 0.035 * tm * 0.5;
  return vec4(off, max(m, tm), trail) * uRain;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 asp = vec2(uRes.x / uRes.y, 1.0);

  vec3 b = beads(uv);
  vec4 r1 = runners(uv, 9.0, 0.0);
  vec4 r2 = runners(uv, 15.0, 11.0);
  vec2 off = b.xy + r1.xy + r2.xy;
  float drops = clamp(b.z + r1.z + r2.z, 0.0, 1.0);
  float trails = clamp(r1.w + r2.w * 0.7, 0.0, 1.0);

  // cursor wipes: fog grows back over a few seconds
  float wipe = 0.0;
  for (int i = 0; i < ${TRAIL}; i++) {
    vec3 p = uTrail[i];
    float age = uTime - p.z;
    if (age < 0.0 || age > 8.0) continue;
    float d = length((uv - p.xy) * asp);
    wipe = max(wipe, smoothstep(0.075, 0.035, d) * exp(-age * 0.45));
  }

  float clearness = clamp(drops + trails * 0.85 + wipe, 0.0, 1.0);
  vec3 sharp = city(uv - off * 0.045, 0.05);
  vec3 fog = city(uv, 1.1) * 0.7 + vec3(0.05, 0.06, 0.08);
  vec3 col = mix(fog, sharp, clearness);

  // drop rims and highlights
  vec3 n = normalize(vec3(-off, 1.0));
  col += pow(max(dot(n, normalize(vec3(-0.3, 0.5, 0.8))), 0.0), 40.0) * drops * 0.6;
  col *= 1.0 - 0.25 * smoothstep(0.6, 1.0, length(off)) * drops;
  col *= 1.0 - 0.3 * length(uv - 0.5);
  outColor = vec4(pow(col, vec3(0.9)), 1.0);
}`

/**
 * Rain on a fogged window over a night city. Drops refract the sharp city
 * behind them, slide down leaving clear trails, and the cursor wipes the glass.
 */
export default function RainGlass({ rain = 1, speed = 1 }) {
  const trail = useRef(new Float32Array(TRAIL * 3).fill(-100))
  const head = useRef(0)
  const last = useRef([9, 9])

  const canvasRef = useShaderCanvas({
    fragment: FRAG,
    dprCap: 1.0,
    speed,
    onFrame: ({ gl, uniform, mouse, time }) => {
      if (mouse.inside) {
        const [lx, ly] = last.current
        if (Math.hypot(mouse.tx - lx, mouse.ty - ly) > 0.012) {
          trail.current.set([mouse.tx, mouse.ty, time], head.current * 3)
          head.current = (head.current + 1) % TRAIL
          last.current = [mouse.tx, mouse.ty]
        }
      }
      gl.uniform3fv(uniform('uTrail'), trail.current)
      gl.uniform1f(uniform('uRain'), rain)
    },
  })

  return <canvas ref={canvasRef} className="fx-canvas" />
}
