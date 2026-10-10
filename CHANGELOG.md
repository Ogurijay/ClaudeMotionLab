# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.2.0] - 2026-10-10

### Added
- Registry-driven showcase page: all 7 chapters and 38 effects generated from `src/app/registry.js`; unfinished effects appear as "coming soon" cards
- `LazyMount`: effects mount near the viewport and unmount when far away (peak 3 live WebGL contexts on a full scroll, budget 6)
- `useShaderCanvas` hook for full-screen fragment-shader effects; `LiquidChrome` migrated to it
- `useReducedMotion` hook and `prefers-reduced-motion` support
- Source viewer: per-effect props table parsed from the component signature, highlighted source files, copy button
- Hero chapter directory, side chapter navigation with scroll progress, chapter intro transition framework
- Project documentation under `docs/`: roadmap, effects catalog (38 effects across 7 categories), architecture, conventions
- `CHANGELOG.md`, `CLAUDE.md`, `.editorconfig`

### Changed
- Source layout reorganized: effects grouped by category under `src/effects/<category>/`, showcase shell under `src/app/`, global styles under `src/styles/`
- `Section` extracted from `App.jsx` into its own module; cyber effects exported from `src/effects/cyber/index.js`
- Three.js effects now release their WebGL context on unmount (`renderer.forceContextLoss()`)
- Roadmap decisions recorded: all 7 categories, 3 flagship effects per chapter first, source viewer moved into P1

## [0.1.0] - 2026-10-10

### Added
- Six original Cyber effects: `LiquidChrome`, `ParticleMorph`, `HoloCard`, `KineticType`, `WaveLines`, `SpiralGallery`
- Long-scroll showcase page
- PolyForm Noncommercial 1.0.0 license

[Unreleased]: https://github.com/Ogurijay/ClaudeMotionLab/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/Ogurijay/ClaudeMotionLab/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Ogurijay/ClaudeMotionLab/releases/tag/v0.1.0
