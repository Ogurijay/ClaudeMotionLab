import { useEffect, useRef } from 'react'
import { useVisibility } from '../hooks/useVisibility'

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`

const FRAG = `#version 300 es
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
  const canvasRef = useRef(null)
  const visible = useVisibility(canvasRef)

  useEffect(() => {
    const canvas = canvasRef.current
    const gl = canvas.getContext('webgl2', { antialias: false })
    if (!gl) return

    const compile = (type, src) => {
      const s = gl.createShader(type)
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s))
      return s
    }
    const prog = gl.createProgram()
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT))
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(prog)
    gl.useProgram(prog)

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const aPos = gl.getAttribLocation(prog, 'aPos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

    const U = name => gl.getUniformLocation(prog, name)
    const uRes = U('uRes'), uTime = U('uTime'), uMouse = U('uMouse'), uRipples = U('uRipples'), uTint = U('uTint')

    const ripples = new Float32Array(32).fill(-100)
    let rippleIdx = 0
    const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 }
    const t0 = performance.now()
    const now = () => ((performance.now() - t0) / 1000) * speed

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 1.5)
      const r = canvas.getBoundingClientRect()
      canvas.width = Math.max(1, (r.width * dpr) | 0)
      canvas.height = Math.max(1, (r.height * dpr) | 0)
      gl.viewport(0, 0, canvas.width, canvas.height)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const toUv = e => {
      const r = canvas.getBoundingClientRect()
      return [(e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height]
    }
    const onMove = e => { [mouse.tx, mouse.ty] = toUv(e) }
    const onDown = e => {
      const [x, y] = toUv(e)
      ripples.set([x, y, now(), 0], rippleIdx * 4)
      rippleIdx = (rippleIdx + 1) % 8
    }
    window.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerdown', onDown)

    let raf
    const loop = () => {
      raf = requestAnimationFrame(loop)
      if (!visible.current) return
      mouse.x += (mouse.tx - mouse.x) * 0.06
      mouse.y += (mouse.ty - mouse.y) * 0.06
      gl.uniform2f(uRes, canvas.width, canvas.height)
      gl.uniform1f(uTime, now())
      gl.uniform2f(uMouse, mouse.x, mouse.y)
      gl.uniform4fv(uRipples, ripples)
      gl.uniform1f(uTint, tint)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }
    loop()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerdown', onDown)
    }
  }, [speed, tint, visible])

  return <canvas ref={canvasRef} className={`fx-canvas ${className}`} />
}
