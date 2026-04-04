# D3 Lab

D3 Lab is an Angular 18 + D3.js chart handbook for developers translating Tableau patterns into reusable D3 implementations. It combines example charts, implementation notes, and data-model guidance in a single reference app.

## Live Site

Explore the deployed guide at [d3-lab.vercel.app](https://d3-lab.vercel.app).

## What's Inside

- Chart guides for bar, pie, grouped horizontal bar, stacked horizontal bar, line, and bullet charts
- Documentation pages for chart data models, AI guidance, and Tableau-to-D3 migration concepts
- Shared chart utilities for resizing, tooltips, click handling, and legends
- Strict standalone Angular components styled with Tailwind CSS and SCSS

## Scripts

```bash
npm install
npm start
npm test
npm run build
```

The dev server runs at `http://localhost:4200`.

## Project Structure

```text
src/app/
├── charts/              # Standalone D3 chart examples, lazy-loaded by route
├── core/models/         # Shared chart interfaces and view models
├── core/services/       # Data transformation logic
├── pages/               # Guide and documentation pages
└── shared/components/   # Sidebar, tooltip, code block, and other reusable UI
```

## Development Notes

- Routes are defined in `src/app/app.routes.ts` using `loadComponent`
- Data is currently hardcoded in components; no backend is involved
- Static assets should live in `public/`
- Production deployment is handled through Vercel

## Deployment

The production site is deployed on Vercel. To publish manually:

```bash
vercel --yes --prod
```
