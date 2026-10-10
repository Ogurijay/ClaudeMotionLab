# 路线图 (Roadmap)

目标：把 Claude Motion Lab 做成一个**按视觉风格分章的长卷轴组件展示页**。页面往下滚动就能依次体验所有效果，每个效果同时也是可单独复用的 React 组件。

效果清单见 [EFFECTS.md](EFFECTS.md)，技术方案见 [ARCHITECTURE.md](ARCHITECTURE.md)。

## 阶段总览

| 阶段 | 内容 | 状态 |
|---|---|---|
| P0 | 项目初始化：首批 6 个 Cyber 效果、GitHub 仓库、许可证、文档与目录规范 | `done` |
| P1 | 展示页底座：懒挂载、效果注册表、共享着色器 hook、侧边导航、章节框架、源码查看面板 | `done` |
| P2 | Pixel 像素章首发：PX-02 DitherLens、PX-03 FallingSand、PX-05 CRTScreen | `done` |
| P3 | Liquid 水滴章首发：LQ-01 RainGlass、LQ-02 InkFluid、LQ-04 GooeyMenu | `done` |
| P4 | Organic 自然章首发：OR-01 GrassField、OR-02 Fireflies、OR-03 ReactionDiffusion | `done` |
| P5 | Paper 纸张章首发：PP-01 PageCurl、PP-04 InkBleed、PP-05 ScribbleUnderline | `done` |
| P6 | Glass & Light 光影章首发：GL-01 RefractionLens、GL-02 PrismText、GL-03 GodRays | `done` |
| P7 | Physics 物理章首发：PH-01 JellyCard、PH-02 ClothBanner、PH-03 MagnetDots | `done` |
| P8 | 打磨与发布：性能审计、移动端适配、GitHub Pages 部署 | `done` |
| P9 | 扩充批次：各章剩余的批次 2 效果（共 14 个，含 CY-07、CY-08） | `wip` |

P2 ~ P7 每章先做 3 个精品首发（见 [EFFECTS.md](EFFECTS.md) 的「批次」列），顺序可按优先级调整。全部首发完成并发布后，再进入 P9 扩充。

---

## P0 · 项目初始化 `done`

- [x] 6 个 Cyber 效果：LiquidChrome、ParticleMorph、HoloCard、KineticType、WaveLines、SpiralGallery
- [x] GitHub 公开仓库，PolyForm Noncommercial 1.0.0 许可证
- [x] 源码目录按类别重组（`src/effects/<category>/`）
- [x] 项目文档体系（`docs/`）、开发规范、CHANGELOG

## P1 · 展示页底座 `done`

**目标**：让页面能承载 40 个左右的效果而不崩、不卡。之后新增效果时，只需写组件并登记一行。

- [x] `LazyMount`：效果进入视口附近时才挂载，远离后卸载，把同时存在的 WebGL 上下文控制在预算内
- [x] `registry.js`：效果注册表，记录编号、类别、名称、标签、提示和组件（懒加载），页面由注册表自动生成
- [x] `useShaderCanvas`：全屏片元着色器的共享 hook，统一处理上下文、尺寸、DPR、鼠标、时间和暂停
- [x] 侧边吸附导航：章节列表、当前章节高亮、滚动进度、点击跳转
- [x] 章节过场框架：每章开头有一个可替换的转场组件
- [x] 把现有 6 个 Cyber 效果迁移到注册表驱动
- [x] 支持 `prefers-reduced-motion`：系统设置减少动效时降级为静态或低频动画（CSS 过渡瞬时化、着色器时间降速；Three.js / Canvas 效果在各自章节中逐步接入）
- [x] 源码查看面板：每个效果可展开查看源码（语法高亮、一键复制），并自动解析出 props 及默认值
- [x] 未完成的效果以「即将推出」卡片展示在所属章节中，让页面直接反映路线图

**验收**：现有 6 个效果表现不变；快速滚动整页时，活跃的 WebGL 上下文不超过预算；控制台无报错。

**结果**：已通过。无头 Chromium 1440×900 滚动整页，WebGL 上下文峰值 3 个（预算 6 个），页尾为 0 个。

## P2 ~ P7 · 各类别章节

每章的通用交付标准：

- [ ] 该章全部效果按 [CONVENTIONS.md](CONVENTIONS.md#完成定义-definition-of-done) 达到完成定义
- [ ] 本章的章节过场（例如：进入像素章时整屏像素化，进入水滴章时屏幕被水淹没）
- [ ] 更新 EFFECTS.md 状态与 CHANGELOG
- [ ] 每章结束提交一次，确认效果后再进入下一章

## P8 · 打磨与发布 `done`

- [x] 性能审计：24 个效果全部上线后复测整页滚动，WebGL 上下文峰值 4 个（预算 6 个）；three.js 独立分包，效果按需懒加载
- [x] 移动端适配：画布默认允许纵向滚动（`touch-action: pan-y`），拖拽类效果单独拦截触摸；小屏降低粒子 / 草叶 / 萤火虫数量；全息卡片文字改用容器查询单位
- [x] 部署到 GitHub Pages（GitHub Actions，推送 `main` 自动发布），README 附在线演示链接与预览图

## P9 · 扩充批次

- [ ] 各章批次 `2` 的效果（共 14 个），逐个按完成定义交付
- [ ] 视情况从候选池中挑选新风格，分配类别与编号后纳入

---

## 决策记录

| # | 问题 | 选项 | 结论 |
|---|---|---|---|
| 1 | 类别取舍：7 个类别是否全做？是否加入候选池中的风格（蒸汽波、霓虹灯管、Y2K、手绘涂鸦）？ | 全做 / 精选 / 追加 | **全做 7 个类别**；候选池保持 `idea`，暂不纳入（2026-10-10） |
| 2 | 每章效果数量 | 每章 4~6 个 / 先做 3 个精品再扩充 | **每章先做 3 个精品首发**，其余作为 P9 扩充（2026-10-10） |
| 3 | 是否做「查看源码」面板（相当于组件文档站） | 做 / 不做 | **做**，提前到 P1 与注册表一起实现（2026-10-10） |
