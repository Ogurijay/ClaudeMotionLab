# 路线图 (Roadmap)

目标：把 Claude Motion Lab 做成一个**按视觉风格分章的长卷轴组件展示页**。页面往下滚动就能依次体验所有效果，每个效果同时也是可单独复用的 React 组件。

效果清单见 [EFFECTS.md](EFFECTS.md)，技术方案见 [ARCHITECTURE.md](ARCHITECTURE.md)。

## 阶段总览

| 阶段 | 内容 | 状态 |
|---|---|---|
| P0 | 项目初始化：首批 6 个 Cyber 效果、GitHub 仓库、许可证、文档与目录规范 | `done` |
| P1 | 展示页底座：懒挂载、效果注册表、共享着色器 hook、侧边导航、章节过场框架 | `planned` |
| P2 | Pixel 像素章（PX-01 ~ PX-06） | `planned` |
| P3 | Liquid 水滴章（LQ-01 ~ LQ-06） | `planned` |
| P4 | Organic 自然章（OR-01 ~ OR-05） | `planned` |
| P5 | Paper 纸张章（PP-01 ~ PP-05） | `planned` |
| P6 | Glass & Light 光影章（GL-01 ~ GL-04） | `planned` |
| P7 | Physics 物理章（PH-01 ~ PH-04） + Cyber 补完（CY-07、CY-08） | `planned` |
| P8 | 打磨与发布：源码查看、性能审计、GitHub Pages 部署 | `planned` |

P4 ~ P7 的先后顺序可按优先级调整。

---

## P0 · 项目初始化 `done`

- [x] 6 个 Cyber 效果：LiquidChrome、ParticleMorph、HoloCard、KineticType、WaveLines、SpiralGallery
- [x] GitHub 公开仓库，PolyForm Noncommercial 1.0.0 许可证
- [x] 源码目录按类别重组（`src/effects/<category>/`）
- [x] 项目文档体系（`docs/`）、开发规范、CHANGELOG

## P1 · 展示页底座

**目标**：让页面能承载 40 个左右的效果而不崩、不卡。之后新增效果时，只需写组件并登记一行。

- [ ] `LazyMount`：效果进入视口附近时才挂载，远离后卸载，把同时存在的 WebGL 上下文控制在预算内
- [ ] `registry.js`：效果注册表，记录编号、类别、名称、标签、提示和组件（懒加载），页面由注册表自动生成
- [ ] `useShaderCanvas`：全屏片元着色器的共享 hook，统一处理上下文、尺寸、DPR、鼠标、时间和暂停
- [ ] 侧边吸附导航：章节列表、当前章节高亮、滚动进度、点击跳转
- [ ] 章节过场框架：每章开头有一个可替换的转场组件
- [ ] 把现有 6 个 Cyber 效果迁移到注册表驱动
- [ ] 支持 `prefers-reduced-motion`：系统设置减少动效时降级为静态或低频动画

**验收**：现有 6 个效果表现不变；快速滚动整页时，活跃的 WebGL 上下文不超过预算；控制台无报错。

## P2 ~ P7 · 各类别章节

每章的通用交付标准：

- [ ] 该章全部效果按 [CONVENTIONS.md](CONVENTIONS.md#完成定义-definition-of-done) 达到完成定义
- [ ] 本章的章节过场（例如：进入像素章时整屏像素化，进入水滴章时屏幕被水淹没）
- [ ] 更新 EFFECTS.md 状态与 CHANGELOG
- [ ] 每章结束提交一次，确认效果后再进入下一章

## P8 · 打磨与发布

- [ ] 「查看源码」面板：展示组件源码与 props 说明（待确认，见下方待决事项）
- [ ] 性能审计：各效果在集成显卡上的帧率，必要时提供低画质档位
- [ ] 移动端适配：触摸交互、低端设备降级
- [ ] 部署到 GitHub Pages，README 附在线演示链接

---

## 待决事项

| # | 问题 | 选项 | 结论 |
|---|---|---|---|
| 1 | 类别取舍：7 个类别是否全做？是否加入候选池中的风格（蒸汽波、霓虹灯管、Y2K、手绘涂鸦）？ | 全做 / 精选 / 追加 | 待定 |
| 2 | 每章效果数量 | 每章 4~6 个 / 先做 3 个精品再扩充 | 待定 |
| 3 | 是否做「查看源码」面板（相当于组件文档站） | 做 / 不做 | 待定 |
