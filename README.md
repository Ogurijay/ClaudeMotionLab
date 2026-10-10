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

All effects live in `src/effects/<category>/` and are configurable through props.

## Roadmap

The six effects above form the **Cyber** chapter. Six more chapters are planned — **Pixel**, **Liquid**, **Organic**, **Paper**, **Glass & Light** and **Physics** — for 38 effects in total, all on one long-scroll showcase page. See the [effects catalog](docs/EFFECTS.md) and [roadmap](docs/ROADMAP.md).

## Project structure

```
src/
├── main.jsx          entry
├── app/              showcase page shell
├── effects/          reusable effect components, grouped by category
│   └── cyber/
├── hooks/            hooks shared across effects
└── styles/           global styles
docs/                 project documentation (Chinese)
```

## Documentation

| Doc | Contents |
|---|---|
| [docs/ROADMAP.md](docs/ROADMAP.md) | Phases, tasks, acceptance criteria |
| [docs/EFFECTS.md](docs/EFFECTS.md) | Every effect: ID, category, description, interaction, tech, status |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Stack, directory layout, rendering approaches, performance |
| [docs/CONVENTIONS.md](docs/CONVENTIONS.md) | Naming, component contract, commits, Definition of Done |
| [CHANGELOG.md](CHANGELOG.md) | Release notes |

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
