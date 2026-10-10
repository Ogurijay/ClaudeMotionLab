# CLAUDE.md

Guidance for AI assistants working in this repository.

## Project

Claude Motion Lab: original 3D & UI motion components (React 19 + Three.js + GLSL + Vite), shown on a long-scroll showcase page grouped by visual style. See `docs/README.md` for the documentation index.

## Commands

- `npm run dev` — dev server
- `npm run build` — production build (must pass before committing)
- Pushing to `main` deploys to GitHub Pages (`.github/workflows/deploy.yml`); live at https://ogurijay.github.io/ClaudeMotionLab/

## Where things live

- `src/effects/<category>/` — reusable effect components, one per file (`cyber`, `pixel`, `liquid`, `organic`, `paper`, `glass`, `physics`)
- `src/app/` — showcase page shell only; effects must never import from here
- `src/hooks/` — hooks shared by two or more effects
- `src/lib/` — non-hook modules shared by effects (e.g. `glsim.js` for multi-pass GPU simulations)
- `src/app/demos.jsx` — showcase-only props per effect (e.g. lighter counts on small screens)
- `docs/EFFECTS.md` — single source of truth for effect IDs, names, descriptions and status

## Rules

- Follow `docs/CONVENTIONS.md` (naming, component contract, GLSL prefixes, Conventional Commits, Definition of Done).
- When adding or finishing an effect, update `docs/EFFECTS.md` and the `[Unreleased]` section of `CHANGELOG.md` in the same commit.
- Keep the WebGL context budget in mind (`docs/ARCHITECTURE.md`): pause offscreen, dispose all GPU resources on unmount.
- Do not use React StrictMode (it double-creates WebGL contexts in dev).
- Single-branch workflow: commit directly on `main`, no feature branches.
- Project docs are written in Chinese; code, comments and commit messages in English.
