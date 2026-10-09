# Claude Motion Lab

Original 3D & UI motion components built from scratch with React, Three.js and GLSL.

## Components

| Component | Tech | Interaction |
|---|---|---|
| `LiquidChrome` | WebGL2 fragment shader | Hover bulges the metal, click sends ripples |
| `ParticleMorph` | Three.js + GLSL, 18k particles | Morphs between text / sphere / knot / galaxy; particles flee the cursor |
| `HoloCard` | CSS 3D, blend modes, spring physics | Holographic foil, sparkle, glare and parallax layers on tilt |
| `KineticType` | Variable font + springs | Letters fatten, get pushed and skew with cursor velocity |
| `WaveLines` | Canvas 2D, noise, occlusion | Living ridge-lines; cursor raises a mountain |
| `SpiralGallery` | Three.js, scroll-driven | Fly through a spiral tunnel; cards bend and RGB-split with scroll speed |

All components live in `src/components/` and are configurable through props.

## Getting started

```bash
npm install
npm run dev
```

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build to `dist/`
- `npm run preview` — preview the production build

## License

[PolyForm Noncommercial License 1.0.0](LICENSE.md) — free to use, modify and share for **noncommercial** purposes. Commercial use is not permitted.

Required Notice: Copyright (c) 2026 Ogurijay (https://github.com/Ogurijay)
