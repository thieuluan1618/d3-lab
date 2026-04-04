# AGENTS.md — d3-lab

## Build & Run
- `ng serve` / `npm start` — dev server (default port 4200)
- `ng build` — production build to `dist/d3-lab/`
- `ng test` — run all Karma/Jasmine tests
- `ng test --include='**/foo.spec.ts'` — run a single test file

## Architecture
Angular 18 standalone-component app using D3.js v7 for data visualizations, styled with Tailwind CSS + SCSS.
- `src/app/charts/` — chart components (bar, pie, line, grouped hbar), each lazy-loaded via routes
- `src/app/pages/` — page-level components (home, models-guide, tableau-d3)
- `src/app/core/models/` — data models; `core/services/` — shared services
- `src/app/shared/components/` — reusable UI (sidebar, etc.)
- Routes defined in `app.routes.ts` using `loadComponent` lazy loading

## Code Style
- **TypeScript strict mode** enabled (`strict`, `noImplicitReturns`, `strictTemplates`)
- All components are **standalone** (no NgModules); use `imports` array in `@Component`
- Styles: SCSS per component (`styleUrl`), global styles in `src/styles.scss`
- Prefix selectors with `app-` (configured in `angular.json`)
- Use `d3` typings from `@types/d3`; import D3 modules granularly
- Follow Angular naming: `kebab-case` filenames, `PascalCase` classes, `camelCase` members
