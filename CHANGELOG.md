# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Project documentation under `docs/`: roadmap, effects catalog (38 effects across 7 categories), architecture, conventions
- `CHANGELOG.md`, `CLAUDE.md`, `.editorconfig`

### Changed
- Source layout reorganized: effects grouped by category under `src/effects/<category>/`, showcase shell under `src/app/`, global styles under `src/styles/`
- `Section` extracted from `App.jsx` into its own module; cyber effects exported from `src/effects/cyber/index.js`

## [0.1.0] - 2026-10-10

### Added
- Six original Cyber effects: `LiquidChrome`, `ParticleMorph`, `HoloCard`, `KineticType`, `WaveLines`, `SpiralGallery`
- Long-scroll showcase page
- PolyForm Noncommercial 1.0.0 license

[Unreleased]: https://github.com/Ogurijay/ClaudeMotionLab/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Ogurijay/ClaudeMotionLab/releases/tag/v0.1.0
