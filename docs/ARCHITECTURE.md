# 技术架构 (Architecture)

## 技术栈

| 项 | 选型 | 说明 |
|---|---|---|
| 构建 | Vite | 开发服务器 + 生产构建 |
| UI | React 19 | 函数组件 + hooks，不使用 StrictMode（避免 WebGL 上下文被重复创建与销毁） |
| 3D | Three.js | 粒子、网格、自定义 ShaderMaterial |
| 着色器 | GLSL ES 3.0 / 1.0 | 原生 WebGL2 全屏着色器，或经 Three.js 的 ShaderMaterial |
| 2D | Canvas 2D | 线条、像素、物理类效果 |
| 字体 | Inter Variable（100–900）、JetBrains Mono | 通过 @fontsource 自托管随构建打包，不依赖外部 CDN |

## 目录结构

```
ClaudeMotionLab/
├── docs/                       项目文档（索引见 docs/README.md）
├── public/                     静态资源（按需创建）
├── src/
│   ├── main.jsx                入口：挂载 App、引入样式
│   ├── app/                    展示页外壳（与具体效果无关的页面结构）
│   │   ├── App.jsx             页面编排：Hero → 侧边导航 → 各章节
│   │   ├── registry.js         效果注册表（页面由它自动生成）
│   │   ├── demos.jsx           需要特殊包装才好展示的效果（按编号）
│   │   ├── Hero.jsx            首屏：背景效果、标题、章节目录
│   │   ├── Chapter.jsx         章节：过场 + 标题 + 已完成效果 + 即将推出卡片
│   │   ├── ChapterNav.jsx      侧边吸附导航：当前章节高亮、滚动进度
│   │   ├── Section.jsx         单个效果的展示区块 + 源码按钮
│   │   ├── EffectView.jsx      按需加载效果模块并渲染 demo
│   │   ├── LazyMount.jsx       视口懒挂载 / 卸载
│   │   ├── SourceViewer.jsx    源码面板：props 解析、语法高亮、复制
│   │   ├── QualityToggle.jsx   画质开关（自动 / 高 / 省电）
│   │   └── transitions/        各章节的自定义过场（index.js 按类别登记）
│   ├── effects/                所有效果组件，按类别分文件夹
│   │   ├── cyber/              CY · 赛博霓虹
│   │   │   ├── index.js        本类别的统一导出
│   │   │   ├── LiquidChrome.jsx
│   │   │   ├── HoloCard.jsx
│   │   │   ├── HoloCard.css    组件私有样式与组件同目录
│   │   │   └── ...
│   │   ├── pixel/              PX · 像素（P2）
│   │   ├── liquid/             LQ · 水滴（P3）
│   │   ├── organic/            OR · 自然（P4）
│   │   ├── paper/              PP · 纸张（P5）
│   │   ├── glass/              GL · 光影（P6）
│   │   └── physics/            PH · 物理（P7）
│   ├── lib/                    跨效果复用的非 hook 工具
│   │   ├── perf.js             性能调节器：画质档位、DPR 上限、自适应分辨率
│   │   ├── glsim.js            多 pass GPU 模拟底座（浮点帧缓冲、双缓冲、程序管理）
│   │   └── artwork.js          程序化插画（海报、风景、证件），作为着色器的图片素材
│   ├── hooks/                  跨效果复用的 hooks
│   │   ├── useShaderCanvas.js  全屏片元着色器底座
│   │   ├── useVisibility.js    视口可见性（用于暂停渲染）
│   │   └── useReducedMotion.js 系统「减少动效」偏好
│   └── styles/
│       ├── global.css          基础样式、首屏、效果区块
│       └── showcase.css        展示页外壳：章节、导航、即将推出卡片、源码面板
├── CHANGELOG.md
├── CLAUDE.md                   给 AI 助手的项目说明
├── LICENSE.md
└── README.md
```

### 分层原则

- **`effects/` 只放可复用的效果组件**，不依赖 `app/` 中的任何东西。任何效果都应该能单独拷贝到其他项目使用。
- **`app/` 只负责展示页**，包括布局、导航、注册表和懒加载，不包含效果的渲染逻辑。
- **`hooks/` 与 `lib/` 放被两个及以上效果复用的逻辑**（前者是 React hooks，后者是普通模块），只被一个效果使用的逻辑留在该组件文件内。效果可以依赖 `hooks/` 和 `lib/`，但不能依赖 `app/`。

## 渲染方式

| 代号 | 方式 | 典型效果 | 上下文开销 |
|---|---|---|---|
| `shader` | 原生 WebGL2 全屏三角形 + 片元着色器 | LiquidChrome | 1 个 WebGL 上下文 |
| `three` | Three.js 场景 | ParticleMorph、SpiralGallery | 1 个 WebGL 上下文 |
| `sim` | 多 pass 模拟（帧缓冲 ping-pong），基于 `lib/glsim.js` | InkFluid、ReactionDiffusion、RipplePond | 1 个 WebGL 上下文 |
| `canvas` | Canvas 2D | WaveLines | 无 |
| `dom` | DOM + CSS / SVG | HoloCard、KineticType | 无 |

能用 `dom` 或 `canvas` 实现且效果不打折扣的，优先不用 WebGL。

## 生命周期与性能

### 视口暂停

`useVisibility(ref)` 基于 IntersectionObserver，返回一个 `.current` 随可见性变化的 ref。渲染循环在不可见时直接跳过绘制，requestAnimationFrame 照常调度，但几乎不耗资源。

### WebGL 上下文预算

浏览器对同一页面的活跃 WebGL 上下文数量有上限（Chrome 约为 16 个），超出时会强制丢失最早创建的上下文。全部效果做完后，WebGL 效果会有 25 个以上，因此：

- 由 `LazyMount` 控制挂载：进入视口 ±1 屏范围内挂载，超出 ±2 屏卸载（滞后区间用来避免边界抖动）
- 目标：同时活跃的 WebGL 上下文 **不超过 6 个**（P8 实测：24 个效果上线后滚动整页，峰值 4 个）
- 组件卸载时必须释放全部 GPU 资源（geometry、material、texture、renderer），并主动释放上下文：
  `useShaderCanvas` 调用 `WEBGL_lose_context`，Three.js 效果调用 `renderer.forceContextLoss()`

### 性能调节（`lib/perf.js`）

- **画质档位**：`auto`（默认，自适应）/ `high`（固定最高分辨率）/ `low`（省电，DPR 上限 0.75），由页面左下角开关切换并记入 localStorage
- **DPR 上限**：`targetDpr(cap)`。柔和、模糊的着色器（LiquidChrome、RainGlass、GodRays、AuroraSky）上限 1；细节型效果 1.25–1.5
- **自适应分辨率**：`createScaler()` 根据帧时间调节渲染比例：低于约 50fps 时快速降到最低 0.5，有余量时缓慢回升。`useShaderCanvas` 已内置；Three.js 效果用 `adaptiveRenderer(renderer, cap, resize)`；ReactionDiffusion 改为调节每帧模拟步数
- **异步着色器编译**：`useShaderCanvas` 与 `glsim` 借助 `KHR_parallel_shader_compile` 在后台编译，就绪后才开始绘制；Three.js 效果在首帧前调用 `renderer.compileAsync`。效果在滚动途中挂载时不会因编译阻塞主线程
- **挂载队列**：`LazyMount` 每次只挂载一个效果，优先离视口中心最近的；屏幕上的效果 50ms 内挂载并可插队，屏幕外的预加载等浏览器空闲
- **渲染隔离**：`.demo__stage` 设置 `contain: strict`，舞台内每帧的 DOM 变化不会引起整页重排、重绘
- **循环休眠**：DOM 动画（HoloCard、SpotlightReveal）在静止或离屏时停止 requestAnimationFrame
- **合成层优先**：能用 transform / opacity 完成的动画不用会触发重绘的属性（例如 SpotlightReveal 用移动镂空遮罩层，而不是每帧改 mask）

### 性能基线

| 项 | 约束 |
|---|---|
| 设备像素比 | 由 `targetDpr(cap)` 统一控制：柔和着色器 1，其余 1.25–1.5；并叠加自适应比例 |
| 帧率目标 | 主流集成显卡上保持 60fps |
| 粒子 / 实例数量 | 单个效果不超过约 36k（GrassField），小屏再减半 |
| 资源 | 效果优先程序化生成纹理与图案，尽量不依赖外部图片 |

### 移动端

- `.fx-canvas` 默认 `touch-action: pan-y`：手指在效果上也能纵向滚动页面；需要拖拽的效果（FallingSand、PageCurl、JellyCard、ClothBanner）在自身画布上设为 `none`
- 小屏（宽度 < 700px）由 `src/app/demos.jsx` 传入更轻的参数：粒子、草叶、萤火虫数量减半左右
- 组件内部文字尺寸优先用容器查询单位（如 HoloCard 的 `cqw`），随组件宽度缩放

## 构建与部署

- `vite.config.js` 使用相对 `base: './'`，同一份构建既能本地预览，也能部署在 GitHub Pages 的子路径下
- three.js 单独分包（约 540 kB，gzip 后约 133 kB），每个效果是独立的懒加载 chunk
- `.github/workflows/deploy.yml`：推送 `main` 后自动 `npm ci && npm run build` 并发布到 GitHub Pages

## 无障碍

- 支持 `prefers-reduced-motion`：CSS 过渡与动画变为瞬时；基于 `useShaderCanvas` 的效果时间流速降为 15%
- 纯装饰性元素使用 `aria-hidden`；文字类效果在容器上保留完整的 `aria-label`

## 效果注册表

`src/app/registry.js` 导出 `categories`（7 个章节，含前缀、标题、主色、描述）和 `effects`（全部 38 个效果）。页面完全由它生成：

- `status: 'done'` 的效果渲染为可交互的展示区块（必须提供 `load` 与 `files`）
- 其余效果在所属章节末尾渲染为「即将推出」卡片

```js
{
  id: 'CY-01',
  category: 'cyber',
  name: 'LiquidChrome',
  status: 'done',              // done | wip | planned
  wave: 1,                     // 1 = 精品首发，2 = 扩充
  desc: '液态金属表面……',
  tags: ['WebGL2', 'GLSL'],
  hint: '移动鼠标让金属鼓起 · 点击荡开涟漪',
  load: () => import('../effects/cyber/LiquidChrome.jsx'),
  files: ['cyber/LiquidChrome.jsx'],   // 源码面板展示的文件（相对 src/effects/）
  layout: 'stage',             // stage（默认，放进统一舞台）| bare（自带布局，如滚动驱动）
  height: '528vh',             // bare 效果卸载时的占位高度
  webgl: true,                 // 占用 WebGL 上下文
}
```

需要特殊包装才好展示的效果（例如三张卡片并排、居中容器），在 `src/app/demos.jsx` 中按编号登记渲染函数；未登记的效果直接渲染为 `<Effect />`。

编号、名称、描述与 [EFFECTS.md](EFFECTS.md) 保持一致。

## 源码面板

`SourceViewer` 通过 `import.meta.glob('../effects/**/*', { query: '?raw' })` 按需读取效果源文件：

- **Props 标签**：从 `export default function Name({ ... })` 的解构参数中自动解析出 props 及默认值，因此组件签名本身就是文档（见 CONVENTIONS「props 都有默认值」）
- **文件标签**：`files` 中的每个文件，用 sugar-high 做语法高亮，可一键复制

## 共享着色器底座 `useShaderCanvas`

全屏片元着色器类效果只需提供 GLSL 和少量回调：

```jsx
const canvasRef = useShaderCanvas({
  fragment: FRAG,                          // GLSL ES 3.0
  speed: 1,
  onFrame: ({ gl, uniform, time }) => { /* 设置自定义 uniform */ },
  onPointerDown: (ctx, [u, v]) => { /* 点击 */ },
})
return <canvas ref={canvasRef} className="fx-canvas" />
```

hook 负责上下文与程序创建、全屏三角形、DPR 上限、尺寸自适应、平滑鼠标、视口暂停、减少动效降级，以及卸载时释放上下文。着色器中声明了 `uRes`、`uTime`、`uMouse` 时会自动赋值。

需要把文字或图案传给着色器时，用 `textures` 选项：`{ uText: (w, h) => canvas }`。函数在启动和每次尺寸变化时以画布像素尺寸调用，结果作为带 mipmap 的纹理上传（InkBleed 就利用 mip 层级来模拟墨水扩散）。
