# 技术架构 (Architecture)

## 技术栈

| 项 | 选型 | 说明 |
|---|---|---|
| 构建 | Vite | 开发服务器 + 生产构建 |
| UI | React 19 | 函数组件 + hooks，不使用 StrictMode（避免 WebGL 上下文被重复创建与销毁） |
| 3D | Three.js | 粒子、网格、自定义 ShaderMaterial |
| 着色器 | GLSL ES 3.0 / 1.0 | 原生 WebGL2 全屏着色器，或经 Three.js 的 ShaderMaterial |
| 2D | Canvas 2D | 线条、像素、物理类效果 |
| 字体 | Inter（可变字重 100–900）、JetBrains Mono | 通过 Google Fonts 加载 |

## 目录结构

```
ClaudeMotionLab/
├── docs/                       项目文档（索引见 docs/README.md）
├── public/                     静态资源（按需创建）
├── src/
│   ├── main.jsx                入口：挂载 App、引入全局样式
│   ├── app/                    展示页外壳（与具体效果无关的页面结构）
│   │   ├── App.jsx             页面编排
│   │   └── Section.jsx         单个效果的展示区块
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
│   ├── hooks/                  跨效果复用的 hooks
│   │   └── useVisibility.js
│   └── styles/
│       └── global.css          全局样式与展示页样式
├── CHANGELOG.md
├── CLAUDE.md                   给 AI 助手的项目说明
├── LICENSE.md
└── README.md
```

P1 计划新增的部分：

```
src/
├── app/
│   ├── registry.js             效果注册表
│   ├── LazyMount.jsx           视口懒挂载
│   ├── ChapterNav.jsx          侧边章节导航
│   └── Chapter.jsx             章节容器 + 过场插槽
└── hooks/
    └── useShaderCanvas.js      全屏着色器共享 hook
```

### 分层原则

- **`effects/` 只放可复用的效果组件**，不依赖 `app/` 中的任何东西。任何效果都应该能单独拷贝到其他项目使用。
- **`app/` 只负责展示页**，包括布局、导航、注册表和懒加载，不包含效果的渲染逻辑。
- **`hooks/` 放被两个及以上效果复用的逻辑**，只被一个效果使用的逻辑留在该组件文件内。

## 渲染方式

| 代号 | 方式 | 典型效果 | 上下文开销 |
|---|---|---|---|
| `shader` | 原生 WebGL2 全屏三角形 + 片元着色器 | LiquidChrome | 1 个 WebGL 上下文 |
| `three` | Three.js 场景 | ParticleMorph、SpiralGallery | 1 个 WebGL 上下文 |
| `sim` | 多 pass 模拟（帧缓冲 ping-pong） | InkFluid、ReactionDiffusion | 1 个 WebGL 上下文 |
| `canvas` | Canvas 2D | WaveLines | 无 |
| `dom` | DOM + CSS / SVG | HoloCard、KineticType | 无 |

能用 `dom` 或 `canvas` 实现且效果不打折扣的，优先不用 WebGL。

## 生命周期与性能

### 视口暂停（已实现）

`useVisibility(ref)` 基于 IntersectionObserver，返回一个 `.current` 随可见性变化的 ref。渲染循环在不可见时直接跳过绘制，requestAnimationFrame 照常调度，但几乎不耗资源。

### WebGL 上下文预算（P1）

浏览器对同一页面的活跃 WebGL 上下文数量有上限（Chrome 约为 16 个），超出时会强制丢失最早创建的上下文。全部效果做完后，WebGL 效果会有 25 个以上，因此：

- 由 `LazyMount` 控制挂载：进入视口 ±1 屏范围内挂载，超出 ±2 屏卸载（滞后区间用来避免边界抖动）
- 目标：同时活跃的 WebGL 上下文 **不超过 6 个**
- 组件卸载时必须释放全部 GPU 资源（geometry、material、texture、renderer）

### 性能基线

| 项 | 约束 |
|---|---|
| 设备像素比 | 全屏着色器上限 1.5，Three.js 场景上限 2 |
| 帧率目标 | 主流集成显卡上保持 60fps |
| 粒子数量 | 单个效果不超过 20k（可通过 props 调整） |
| 资源 | 效果优先程序化生成纹理与图案，尽量不依赖外部图片 |

### 无障碍

- P1 起支持 `prefers-reduced-motion`：降级为静态画面或低频动画
- 纯装饰性元素使用 `aria-hidden`；文字类效果在容器上保留完整的 `aria-label`

## 效果注册表结构（P1 草案）

```js
// src/app/registry.js
export const categories = [
  { id: 'cyber', prefix: 'CY', title: 'Cyber', subtitle: '赛博霓虹' },
  // ...
]

export const effects = [
  {
    id: 'CY-01',
    category: 'cyber',
    name: 'LiquidChrome',
    tags: ['WebGL2', 'GLSL'],
    hint: '移动鼠标让金属鼓起 · 点击荡开涟漪',
    component: () => import('../effects/cyber/LiquidChrome.jsx'),
    stage: 'default',            // default | bare（自带全屏 / 滚动布局）
    webgl: true,                 // 计入上下文预算
  },
  // ...
]
```

编号、名称、描述与 [EFFECTS.md](EFFECTS.md) 保持一致。
