import { useEffect, useRef } from 'react'
import { useVisibility } from './useVisibility'
import { useReducedMotion } from './useReducedMotion'

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`

/**
 * Shared plumbing for full-screen fragment-shader effects (WebGL2).
 *
 * Handles context + program setup, a single full-screen triangle, DPR-capped
 * resizing, a smoothed pointer, offscreen pausing, reduced motion and cleanup.
 * Built-in uniforms are set automatically when the shader declares them:
 *   uRes (vec2, pixels) · uTime (float, seconds) · uMouse (vec2, uv 0..1, y up)
 *
 * @param {object}   opts
 * @param {string}   opts.fragment        GLSL ES 3.0 fragment shader source
 * @param {number}   [opts.dprCap=1.5]    max device pixel ratio
 * @param {number}   [opts.speed=1]       time multiplier
 * @param {number}   [opts.mouseEase=0.06] pointer smoothing (0..1, 1 = no smoothing)
 * @param {Function} [opts.onFrame]       (ctx) => void, set custom uniforms each frame
 * @param {Function} [opts.onPointerDown] (ctx, uv) => void
 * @param {Record<string, (w: number, h: number) => TexImageSource>} [opts.textures]
 *        sampler uniforms drawn by a function (e.g. text on a 2D canvas); called with the
 *        canvas pixel size on start and on every resize, uploaded with mipmaps
 * @param {Array}    [deps=[]]            rebuild the program when these change
 * @returns {React.RefObject<HTMLCanvasElement>} attach to a <canvas>
 */
export function useShaderCanvas(opts, deps = []) {
  const canvasRef = useRef(null)
  const visible = useVisibility(canvasRef)
  const reduced = useReducedMotion()
  const optsRef = useRef(opts)
  optsRef.current = opts

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
    const vs = compile(gl.VERTEX_SHADER, VERT)
    const fs = compile(gl.FRAGMENT_SHADER, optsRef.current.fragment)
    const program = gl.createProgram()
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program))
    gl.useProgram(program)

    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const aPos = gl.getAttribLocation(program, 'aPos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

    const locs = new Map()
    const uniform = name => {
      if (!locs.has(name)) locs.set(name, gl.getUniformLocation(program, name))
      return locs.get(name)
    }

    // optional textures, regenerated at canvas resolution on every resize
    const texNames = Object.keys(optsRef.current.textures ?? {})
    const texs = texNames.map(() => gl.createTexture())
    const uploadTextures = () => {
      const fns = optsRef.current.textures
      if (!fns) return
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
      texNames.forEach((name, i) => {
        gl.activeTexture(gl.TEXTURE0 + i)
        gl.bindTexture(gl.TEXTURE_2D, texs[i])
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fns[name](canvas.width, canvas.height))
        gl.generateMipmap(gl.TEXTURE_2D)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        gl.uniform1i(uniform(name), i)
      })
    }

    const timeScale = reduced ? 0.15 : 1
    const ctx = {
      gl, program, canvas, uniform,
      time: 0,
      mouse: { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, inside: false },
    }

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, optsRef.current.dprCap ?? 1.5)
      const r = canvas.getBoundingClientRect()
      canvas.width = Math.max(1, (r.width * dpr) | 0)
      canvas.height = Math.max(1, (r.height * dpr) | 0)
      gl.viewport(0, 0, canvas.width, canvas.height)
      uploadTextures()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const toUv = e => {
      const r = canvas.getBoundingClientRect()
      return [(e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height]
    }
    const onMove = e => {
      const [x, y] = toUv(e)
      ctx.mouse.tx = x
      ctx.mouse.ty = y
      ctx.mouse.inside = x >= 0 && x <= 1 && y >= 0 && y <= 1
    }
    const onDown = e => optsRef.current.onPointerDown?.(ctx, toUv(e))
    window.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerdown', onDown)

    const t0 = performance.now()
    let raf
    const loop = () => {
      raf = requestAnimationFrame(loop)
      if (!visible.current) return
      const o = optsRef.current
      const ease = o.mouseEase ?? 0.06
      ctx.time = ((performance.now() - t0) / 1000) * (o.speed ?? 1) * timeScale
      ctx.mouse.x += (ctx.mouse.tx - ctx.mouse.x) * ease
      ctx.mouse.y += (ctx.mouse.ty - ctx.mouse.y) * ease
      gl.uniform2f(uniform('uRes'), canvas.width, canvas.height)
      gl.uniform1f(uniform('uTime'), ctx.time)
      gl.uniform2f(uniform('uMouse'), ctx.mouse.x, ctx.mouse.y)
      o.onFrame?.(ctx)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }
    loop()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerdown', onDown)
      texs.forEach(t => gl.deleteTexture(t))
      gl.deleteBuffer(buffer)
      gl.deleteProgram(program)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, reduced, ...deps])

  // Release the GPU context as soon as the component unmounts (not on deps changes,
  // which reuse the same canvas) so lazily mounted effects stay within budget.
  useEffect(() => {
    const canvas = canvasRef.current
    return () => canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext()
  }, [])

  return canvasRef
}
