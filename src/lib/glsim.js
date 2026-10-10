// Minimal WebGL2 toolkit for multi-pass GPU simulations (fluids, reaction–diffusion…):
// full-screen quad, programs with cached uniforms, half-float render targets and ping-pong pairs.

export const QUAD_VS = /* glsl */ `#version 300 es
layout(location = 0) in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`

/**
 * @param {HTMLCanvasElement} canvas
 * @returns {null | {
 *   gl: WebGL2RenderingContext,
 *   program: (fs: string, vs?: string) => { use: () => object, u: Record<string, WebGLUniformLocation> },
 *   target: (w: number, h: number, filter?: number, precision?: 'half' | 'float') => object,
 *   doubleTarget: (w: number, h: number, filter?: number, precision?: 'half' | 'float') => object,
 *   draw: (target?: object | null) => void,
 *   dispose: () => void,
 * }}
 */
export function createSim(canvas) {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false })
  if (!gl || !gl.getExtension('EXT_color_buffer_float')) return null

  const vao = gl.createVertexArray()
  gl.bindVertexArray(vao)
  const vbo = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

  const programs = [], textures = [], fbos = []

  const compile = (type, src) => {
    const s = gl.createShader(type)
    gl.shaderSource(s, src)
    gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s))
    return s
  }

  function program(fs, vs = QUAD_VS) {
    const p = gl.createProgram()
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs))
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs))
    gl.linkProgram(p)
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p))
    const u = {}
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS)
    for (let i = 0; i < n; i++) {
      const name = gl.getActiveUniform(p, i).name.replace(/\[0\]$/, '')
      u[name] = gl.getUniformLocation(p, name)
    }
    programs.push(p)
    const handle = { u, use: () => { gl.useProgram(p); return handle } }
    return handle
  }

  // 'half' (RGBA16F) is plenty for fluids; 'float' (RGBA32F) for stiff systems like reaction–diffusion.
  // Float textures are only linearly filterable with OES_texture_float_linear, so prefer NEAREST with 'float'.
  function target(w, h, filter = gl.LINEAR, precision = 'half') {
    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    if (precision === 'float') gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, null)
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null)
    const fbo = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
    gl.viewport(0, 0, w, h)
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    textures.push(tex)
    fbos.push(fbo)
    return {
      tex, fbo, w, h,
      texel: [1 / w, 1 / h],
      /** bind to a texture unit and return the unit index (for sampler uniforms) */
      bind(unit) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); return unit },
    }
  }

  function doubleTarget(w, h, filter, precision) {
    let a = target(w, h, filter, precision), b = target(w, h, filter, precision)
    return {
      w, h, texel: a.texel,
      get read() { return a },
      get write() { return b },
      swap() { [a, b] = [b, a] },
    }
  }

  function draw(t = null) {
    if (t) { gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo); gl.viewport(0, 0, t.w, t.h) }
    else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight) }
    gl.drawArrays(gl.TRIANGLES, 0, 6)
  }

  function dispose() {
    programs.forEach(p => gl.deleteProgram(p))
    textures.forEach(t => gl.deleteTexture(t))
    fbos.forEach(f => gl.deleteFramebuffer(f))
    gl.deleteBuffer(vbo)
    gl.deleteVertexArray(vao)
    gl.getExtension('WEBGL_lose_context')?.loseContext()
  }

  return { gl, program, target, doubleTarget, draw, dispose }
}
