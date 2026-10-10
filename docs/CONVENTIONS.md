# 开发规范 (Conventions)

## 命名

| 对象 | 规则 | 示例 |
|---|---|---|
| 效果组件 / 文件 | PascalCase，文件名与默认导出的组件名一致 | `RainGlass.jsx` |
| 组件私有样式 | 与组件同名同目录 | `HoloCard.css` |
| 类别文件夹 | 小写英文单词 | `effects/pixel/` |
| hooks | `use` 前缀 camelCase | `useShaderCanvas.js` |
| CSS 类名 | 以组件缩写为块名的 BEM 风格 | `.holo__foil`、`.kt__char` |
| 效果编号 | `<类别前缀>-<两位序号>` | `LQ-02` |

## 效果组件约定

1. **一个文件一个效果**，`export default` 组件本身；同时在类别的 `index.js` 中具名导出。
2. **自包含**：不依赖 `src/app/`，不读写全局状态，可以单独拷贝到其他项目使用。
3. **props 都有默认值**：组件不传任何 props 也能完整展示效果。颜色、数量、速度、文案等应该可以通过 props 配置。
4. **填满父容器**：组件根元素铺满父元素（`width/height: 100%` 或 `position: absolute; inset: 0`），尺寸由使用者决定，内部用 ResizeObserver 自适应。
5. **完整清理**：`useEffect` 的清理函数必须移除所有事件监听、取消 requestAnimationFrame、断开观察器，并释放 GPU 资源；Three.js 效果额外调用 `renderer.forceContextLoss()`。
6. **视口暂停**：持续动画的效果必须使用 `useVisibility`（或 `useShaderCanvas`，它已内置），不可见时跳过渲染。
7. **effect 依赖稳定**：数组、对象类 props 先转成字符串 key（如 `colors.join('|')`）再放入依赖数组，避免每次渲染都重建场景。
8. **组件顶部写 JSDoc 注释**：一句话说明效果和交互方式。
9. **遵守性能约定**（详见 ARCHITECTURE「性能调节」）：
   - 画布 DPR 一律走 `targetDpr(cap)`，WebGL 效果接入自适应分辨率（`useShaderCanvas` 已内置，Three.js 用 `adaptiveRenderer`）
   - Three.js 效果首帧前 `renderer.compileAsync`；`glsim` 效果在 `sim.ready()` 之后再绘制
   - 动画循环里不读布局（`getBoundingClientRect`、`offsetLeft` 等），需要时在尺寸变化或滚动时缓存
   - 不在动画画布上方使用 `backdrop-filter`；能用 transform / opacity 的动画不用会触发重绘的属性
   - DOM 动画在静止或离屏时停止 requestAnimationFrame

## 新增一个效果的步骤

1. 在 [EFFECTS.md](EFFECTS.md) 确认编号与描述，状态改为 `wip`
2. 在 `src/effects/<category>/` 新建 `<Name>.jsx`（需要时加同名 `.css`），并在该类别的 `index.js` 中导出
3. 全屏着色器类效果优先基于 `useShaderCanvas`，其余类型参照同类已有效果
4. 在 `src/app/registry.js` 中把该效果的 `status` 改为 `'done'`，补上 `load`、`files`、`hint`、`tags`
5. 默认渲染不好看时，在 `src/app/demos.jsx` 中按编号登记包装
6. 对照下文「完成定义」逐项检查，然后同步更新 EFFECTS.md 状态与 CHANGELOG

## GLSL 约定

- 着色器以模板字符串内联在组件文件中，前面加 `/* glsl */` 标记以获得编辑器高亮
- 命名前缀：`uniform` 用 `u`（`uTime`），`attribute` 用 `a`（`aRand`），`varying` 用 `v`（`vUv`）
- 原生 WebGL2 着色器使用 `#version 300 es`；Three.js 的 ShaderMaterial 沿用其默认版本
- 复杂的数学段落（噪声、SDF、光照模型）写简短注释说明意图

## 样式

- 全局与展示页样式写在 `src/styles/global.css`
- 组件私有样式与组件同目录，在组件内 `import`
- 可调参数优先暴露为 CSS 自定义属性（例如 HoloCard 的 `--hue`）
- 配色基调：背景 `#07070b`；各类别可定义自己的主色，但要保证文字对比度

## Git 与提交

- 只使用 `main` 一个分支，直接在 `main` 上提交，不建功能分支；每次提交前确保 `npm run lint` 与 `npm run build` 通过，`main` 始终可运行
- 提交信息遵循 [Conventional Commits](https://www.conventionalcommits.org/)，`scope` 使用类别或模块名：

```
feat(pixel): add DitherLens (PX-02)
fix(cyber): clamp SpiralGallery bend at high scroll speed
docs: update effects catalog statuses
refactor(app): extract LazyMount
chore: bump three to 0.187
```

| type | 用途 |
|---|---|
| `feat` | 新效果、新功能 |
| `fix` | 修复缺陷 |
| `perf` | 性能优化 |
| `refactor` | 不改变行为的重构 |
| `docs` | 仅文档 |
| `style` | 仅格式，不影响逻辑 |
| `chore` | 依赖、配置、脚手架 |

- 一个效果一个提交（含组件、注册表登记和文档更新）
- 不提交 `node_modules/`、`dist/` 和本地工具配置（如 `.claude/`）

## 文档维护

| 发生了什么 | 需要更新 |
|---|---|
| 新增或完成一个效果 | `docs/EFFECTS.md`（状态 / 描述）、`CHANGELOG.md`（Unreleased 段） |
| 规划了新效果或新类别 | `docs/EFFECTS.md`（分配编号，状态 `planned`） |
| 阶段开始或完成 | `docs/ROADMAP.md`（勾选任务、更新状态） |
| 目录结构、渲染方式或性能策略变化 | `docs/ARCHITECTURE.md` |
| 规范本身变化 | `docs/CONVENTIONS.md` |
| 发布一个版本 | `CHANGELOG.md` 把 Unreleased 归档为版本号，同步 `package.json` 的 `version` |

文档统一放在 `docs/` 下（`README.md`、`CHANGELOG.md`、`LICENSE.md`、`CLAUDE.md` 按惯例留在根目录），新增文档需在 [docs/README.md](README.md) 登记。

## 版本号

遵循 [语义化版本](https://semver.org/lang/zh-CN/)。在 1.0 之前：

- 完成一个阶段（P1 ~ P8），递增 minor（`0.2.0`、`0.3.0` ……）
- 修复与小改动，递增 patch
- 全部类别完成并部署后发布 `1.0.0`

## 完成定义 (Definition of Done)

一个效果标为 `done` 前，必须满足：

- [ ] 符合上文「效果组件约定」的 9 条
- [ ] 在展示页中可交互，交互提示文案准确
- [ ] 浏览器控制台无报错与警告
- [ ] 滚出视口后不再消耗渲染资源；卸载后无残留监听或 GPU 资源
- [ ] 窗口缩放时布局与画面正确自适应
- [ ] `npm run lint` 与 `npm run build` 都通过
- [ ] `EFFECTS.md`、`CHANGELOG.md` 已更新
