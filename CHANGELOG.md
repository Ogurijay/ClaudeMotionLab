# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.1.0] - 2026-10-10

### Added
- **Cyber chapter** completed:
  - `GlitchImage` (CY-07): signal corruption on a neon poster — slice tearing, RGB split, block corruption, rolling, noise; driven by cursor speed, click for a burst
  - `HoloScanner` (CY-08): a holographic ID card materialises under a scanning beam with flicker and chromatic jitter, then dissolves into static
  - Cyber chapter intro transition: RGB interference bars before the header locks in
- **Pixel chapter** completed:
  - `PixelDissolve` (PX-01): multi-level mosaic that resolves block by block outward from the cursor and crumbles back when it leaves
  - `PixelText` (PX-04): a word built from blocks that drop in Tetris-style; blocks hop under the cursor, a click blows it apart and it rebuilds
  - `PixelTrail` (PX-06): 8-bit spark trail with screen persistence, explosions and shock rings
- `src/lib/artwork.js`: procedural artwork (neon poster, landscape, ID card) used as image sources so effects ship without image assets

## [1.0.0] - 2026-10-10

First stable release: all seven chapters have their flagship effects, the page is deployed, and the project is documented.

### Added
- GitHub Pages deployment via GitHub Actions; live demo at https://ogurijay.github.io/ClaudeMotionLab/
- README rewritten with the full chapter catalog, live demo link and preview collage (`docs/assets/preview.jpg`)
- Lighter workloads on small screens (particles, grass blades, fireflies)

### Changed
- Canvases allow vertical page scrolling on touch screens (`touch-action: pan-y`); drag-driven effects opt out
- `HoloCard` text scales with the card via container query units
- Relative Vite `base` so one build works locally and under the Pages sub-path; three.js split into its own chunk

### Verified
- Full-page scroll with all 24 effects: peak 4 live WebGL contexts (budget 6), no console errors

## [0.8.0] - 2026-10-10

### Added
- **Physics chapter** flagship effects:
  - `JellyCard` (PH-01): soft-body card simulated with 2D shape matching and a gaussian soft grab; it stretches, wobbles and springs back home, rendered as a glossy bilinear-interpolated mesh
  - `ClothBanner` (PH-02): Verlet cloth banner on a rod with structural, shear and bending constraints and gusty aerodynamic wind; hover blows on it, drag pulls the fabric
  - `MagnetDots` (PH-03): iron filings aligning with a multi-pole magnetic field; the cursor is a north pole, clicks drop alternating south/north poles
- Physics chapter intro transition: blocks fall, bounce and settle
- All 24 flagship effects across the 7 chapters are now live

## [0.7.0] - 2026-10-10

### Added
- **Glass & Light chapter** flagship effects:
  - `RefractionLens` (GL-01): a weighted glass lens follows the cursor over an editorial poster — SDF surface normals, magnifying refraction, chromatic dispersion at the rim, fresnel and specular; click to morph between sphere and pill
  - `PrismText` (GL-02): the cursor is a light source; each wavelength sees the glyphs at a slightly different offset and coloured rays stream away from the letters
  - `GodRays` (GL-03): screen-space light scattering — a sun behind cut-out lettering throws crepuscular rays through dusty air, with rim-lit silhouettes
- Glass & Light chapter intro transition: a bright beam sweeps across and leaves the header lit
- `useShaderCanvas` redraws texture uniforms once web fonts have loaded

## [0.6.0] - 2026-10-10

### Added
- **Paper chapter** flagship effects:
  - `PageCurl` (PP-01): drag a magazine page corner and it wraps around a cylinder, tracking the cursor exactly; release past the spine to turn the page (mirrored show-through on the back, shadow on the next page)
  - `InkBleed` (PP-04): calligraphy soaking into xuan paper — strokes grow from their spines through blurred mip levels, feather along paper fibres and pool at the wet edge; click to re-ink
  - `ScribbleUnderline` (PP-05): hand-drawn underline / circle / highlight / strike / box annotations that draw themselves stroke by stroke and re-scribble on hover
- Paper chapter intro transition: paper strips fold away like an unfolding sheet
- `useShaderCanvas` accepts `textures`: sampler uniforms drawn by a function at canvas resolution, uploaded with mipmaps

## [0.5.0] - 2026-10-10

### Added
- **Organic chapter** flagship effects:
  - `GrassField` (OR-01): 60k instanced grass blades in travelling wind gusts at dusk; the cursor flattens the blades around it
  - `Fireflies` (OR-02): flocking fireflies whose flashes gradually synchronise (Kuramoto coupled oscillators) with a live synchrony meter; they follow the cursor, a click scatters them
  - `ReactionDiffusion` (OR-03): Gray–Scott reaction–diffusion on the GPU with coral, mitosis, maze and worm presets; hover to seed growth
- Organic chapter intro transition: vines sprout and curl up through the header
- `glsim` render targets support 32-bit float precision

### Changed
- Replaced deprecated `THREE.Clock` with `performance.now()` timing

## [0.4.0] - 2026-10-10

### Added
- **Liquid chapter** flagship effects:
  - `RainGlass` (LQ-01): rain on a fogged window over a procedural night-city bokeh (analytic blur); drops refract, slide and leave clear trails; the cursor wipes the fog, which slowly returns
  - `InkFluid` (LQ-02): GPU stable-fluids simulation with vorticity confinement and lit, hue-preserving ink; stir with the cursor, click to splash
  - `GooeyMenu` (LQ-04): radial action menu and stretching tab indicator built on an SVG goo filter
- Liquid chapter intro transition: the header starts flooded, then drains with a rolling surface and bubbles
- `src/lib/glsim.js`: shared WebGL2 toolkit for multi-pass simulations (half-float targets, ping-pong pairs, programs)
- Source viewer can show shared code (`hooks/`, `lib/`) next to an effect's own files

## [0.3.0] - 2026-10-10

### Added
- **Pixel chapter** flagship effects:
  - `DitherLens` (PX-02): Bayer 8×8 ordered dithering over a procedural synthwave scene with four palettes; a cursor lens reveals full colour
  - `FallingSand` (PX-03): cellular-automaton sandbox with sand, water, stone, wood, fire and smoke; paint with the toolbar
  - `CRTScreen` (PX-05): barrel distortion and chromatic aberration applied to live DOM via SVG filters, scanlines, shadow mask, power on/off animation, interactive terminal
- Pixel chapter intro transition: a wall of pixel blocks that dissolves
- `DefaultIntro` extracted so custom chapter transitions can compose it

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

[Unreleased]: https://github.com/Ogurijay/ClaudeMotionLab/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/Ogurijay/ClaudeMotionLab/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Ogurijay/ClaudeMotionLab/compare/v0.8.0...v1.0.0
[0.8.0]: https://github.com/Ogurijay/ClaudeMotionLab/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/Ogurijay/ClaudeMotionLab/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/Ogurijay/ClaudeMotionLab/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/Ogurijay/ClaudeMotionLab/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/Ogurijay/ClaudeMotionLab/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/Ogurijay/ClaudeMotionLab/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Ogurijay/ClaudeMotionLab/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Ogurijay/ClaudeMotionLab/releases/tag/v0.1.0
