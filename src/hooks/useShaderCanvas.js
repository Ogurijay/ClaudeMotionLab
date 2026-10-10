import { useEffect, useRef } from 'react'
import { useVisibility } from './useVisibility'
import { useReducedMotion } from './useReducedMotion'
import { createScaler, onQuality, targetDpr } from '../lib/perf'

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`

/**
 * Shared plumbing for full-screen fragment-shader effects (WebGL2).
 *
 * Handles context + program setup, a single full-screen triangle, DPR-capped
 * resizing with adaptive resolution (see lib/perf.js), a smoothed pointer,
 * offscreen pausing, reduced motion and cleanup.
 * Built-in uniforms are set automatically when the shader declares them:
 *   uRes (vec2, pixels) · uTime (float, seconds) · uMouse (vec2, uv 0..1, y up)
 *
 * @param {object}   opts
 * @param {string}   opts.fragment        GLSL ES 3.0 fragment shader source
 * @param {number}   [opts.dprCap=1.5]    max device pixel ratio (soft, blurry shaders can use ~1)
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

    // Compile without querying status: with KHR_parallel_shader_compile the driver builds the
    // program in the background and the loop only starts drawing once it is done, so mounting
    // an effect mid-scroll never stalls the main thread on shader compilation.
    const compile = (type, src) => {
      const sh = gl.createShader(type)
      gl.shaderSource(sh, src)
      gl.compileShader(sh)
      return sh
    }
    const vs = compile(gl.VERTEX_SHADER, VERT)
    const fs = compile(gl.FRAGMENT_SHADER, optsRef.current.fragment)
    const program = gl.createProgram()
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.bindAttribLocation(program, 0, 'aPos')
    gl.linkProgram(program)
    const parallel = gl.getExtension('KHR_parallel_shader_compile')
    let ready = false, failed = false

    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

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
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fns[name](texSize.w, texSize.h))
        gl.generateMipmap(gl.TEXTURE_2D)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      })
      if (ready) bindSamplers()
    }
    const bindSamplers = () => texNames.forEach((name, i) => gl.uniform1i(uniform(name), i))

    // true once the program has finished compiling and linking (polled once per frame)
    const checkReady = () => {
      if (parallel && !gl.getProgramParameter(program, parallel.COMPLETION_STATUS_KHR)) return false
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        failed = true
        console.error('useShaderCanvas:', gl.getShaderInfoLog(fs) || gl.getProgramInfoLog(program))
        return false
      }
      gl.useProgram(program)
      bindSamplers()
      ready = true
      return true
    }

    const timeScale = reduced ? 0.15 : 1
    const ctx = {
      gl, program, canvas, uniform,
      time: 0,
      mouse: { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, inside: false },
    }

    // canvas resolution = CSS size × capped DPR × adaptive scale; textures stay at the
    // unscaled size so a temporary resolution drop doesn't force redrawing them
    const scaler = createScaler()
    const texSize = { w: 0, h: 0 }
    let rect = canvas.getBoundingClientRect()
    const resize = (redrawTextures = true) => {
      const dpr = targetDpr(optsRef.current.dprCap ?? 1.5)
      rect = canvas.getBoundingClientRect()
      canvas.width = Math.max(1, (rect.width * dpr * scaler.scale) | 0)
      canvas.height = Math.max(1, (rect.height * dpr * scaler.scale) | 0)
      gl.viewport(0, 0, canvas.width, canvas.height)
      const tw = Math.max(1, (rect.width * dpr) | 0), th = Math.max(1, (rect.height * dpr) | 0)
      if (redrawTextures || tw !== texSize.w || th !== texSize.h) {
        texSize.w = tw
        texSize.h = th
        uploadTextures()
      }
    }
    resize()
    const ro = new ResizeObserver(() => resize())
    ro.observe(canvas)
    const offQuality = onQuality(() => { scaler.reset(); resize() })
    const onScroll = () => { rect = null }
    window.addEventListener('scroll', onScroll, { passive: true })
    // text textures drawn before web fonts arrive would use fallback fonts: redraw once they load
    let disposed = false
    if (texNames.length) document.fonts?.ready.then(() => { if (!disposed) uploadTextures() })

    // pointer mapping uses a cached rect (refreshed after scroll/resize) to avoid forced layouts
    const toUv = e => {
      const r = rect ?? (rect = canvas.getBoundingClientRect())
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
    let raf, last = 0
    const loop = now => {
      raf = requestAnimationFrame(loop)
      if (!visible.current || failed) { last = 0; return }
      if (!ready && !checkReady()) return
      if (last) { if (scaler.tick(now - last)) resize(false) } else scaler.reset()
      last = now
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
    raf = requestAnimationFrame(loop)

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      offQuality()
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerdown', onDown)
      texs.forEach(t => gl.deleteTexture(t))
      gl.deleteBuffer(buffer)
      gl.deleteProgram(program)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
    }
  }, [visible, reduced, ...deps])

  // Release the GPU context as soon as the component unmounts (not on deps changes,
  // which reuse the same canvas) so lazily mounted effects stay within budget.
  useEffect(() => {
    const canvas = canvasRef.current
    return () => canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext()
  }, [])

  return canvasRef
}
