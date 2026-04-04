# AGENTS.md

This file provides guidance to coding agents working with code in this repository.

## Commands

```bash
npm start          # dev server at http://localhost:4200
npm run build      # production build → dist/d3-lab/browser/
npm test           # unit tests via Karma
vercel --yes --prod  # deploy to production
```

For builds with source maps: `npx ng build --configuration production --source-map`

## Architecture

This is an Angular 18 + D3.js v7 chart handbook — a living guide for developers migrating Tableau charts to D3. It is NOT an app with a backend; all data is currently hardcoded in components. The upcoming work will introduce a `MockApiService` and wire real data flow through `@Input()`.

### Key directories

```
src/app/
├── core/
│   ├── models/chart.models.ts       # All shared interfaces (see 5-layer model below)
│   ├── models/index.ts              # Re-exports
│   └── services/chart-transform.service.ts  # Data transform logic (never transform in components)
├── charts/                          # One standalone component per chart type
│   └── d3-{name}/
├── shared/components/
│   ├── chart-tooltip/               # TooltipState, TooltipRow, emptyTooltip() — used by all charts
│   ├── code-block/                  # highlight.js syntax highlighting
│   └── sidebar/                     # Nav (add new routes here + app.routes.ts)
└── pages/                           # Guide/doc pages (home, models, ai-guide, tableau-d3)
```

Static files served by Angular (assets, downloadable files) go in `public/`, not `src/assets/`.

### 5-layer data model (`chart.models.ts`)

Every chart follows this pipeline — **never skip layers or transform in components**:

```
Layer 1: MetricRecord / PeriodData     ← raw API shape
Layer 2: ChartConfig                   ← how to render (type, axes, colors, toggles)
Layer 3: ChartSeries / ChartPoint      ← D3-ready data (via ChartTransformService)
Layer 4: TooltipContext / TooltipSeries ← tooltip state at hovered position
Layer 5: ChartView                     ← dashboard panel (config + data + UI state)
```

### Chart component pattern

Every chart component follows this exact structure — don't deviate:

```typescript
export class D3FooComponent implements OnInit, OnDestroy {
  @ViewChild('chart', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;
  @ViewChild('chartContainer', { static: true }) private containerRef!: ElementRef<HTMLDivElement>;

  tooltip: TooltipState = emptyTooltip();
  private destroyResize?: () => void;

  ngOnInit(): void {
    this.draw();
    this.destroyResize = observeResize(this.containerRef.nativeElement, () => this.draw());
  }
  ngOnDestroy(): void { this.destroyResize?.(); }

  private draw(): void {
    d3.select(this.svgRef.nativeElement).selectAll('*').remove();
    const containerWidth = this.containerRef.nativeElement.clientWidth - 48; // p-6 padding
    const { g: svg, width, height } = initSvg(svgEl, Math.max(400, containerWidth), 350, margin);
    // 1. scales  2. axes  3. marks  4. attachTooltip  5. attachClick  6. drawLegend
  }
}
```

HTML template always has `#chartContainer` on the outer div and `#chart` on the `<svg>`. Container must have `position: relative` for tooltip positioning.

### Shared D3 helpers (`core/utils/d3.helpers.ts`)

- `initSvg(el, totalWidth, totalHeight, margin)` → `{ root, g, width, height }` — use `root` for legends outside the margin, `g` for all chart content
- `observeResize(el, callback, debounceMs?)` → cleanup fn — wraps ResizeObserver with debounce
- `attachTooltip(selection, { onUpdate }, buildRows)` — wires mouseover/move/leave; sets opacity 0.7 on hover
- `attachClick(selection, onClick)` — emits `ChartClickEvent<Datum>`
- `drawLegend(container, items, x, y, options?)` — `style: 'rect'|'line'`, `layout: 'vertical'|'horizontal'`, `onHighlight` callback; legend click dims others to 30% opacity (highlight, not hide)

**Exception**: Multi-series line chart uses manual mouse handlers instead of `attachTooltip` to aggregate all series values at a given x position.

### Tooltip

`TooltipState` / `TooltipRow` / `emptyTooltip()` are defined in `chart-tooltip.component.ts` (not in `chart.models.ts`). Import from there. The `<app-chart-tooltip [state]="tooltip" />` is an Angular component placed inside the chart container div.

### Adding a new chart

1. `npx ng generate component charts/d3-{name} --standalone --skip-tests`
2. Add route to `app.routes.ts` (lazy-loaded)
3. Add nav item to `sidebar.component.ts`
4. Follow the draw() + observeResize() component pattern above
5. Add CSS classes on D3 elements for legend targeting (e.g. `.series-Revenue`, `.bar-ProductA`)
6. Add code snippet string properties for the guide page

### Routing

All routes are lazy-loaded in `app.routes.ts`. Chart guides live under `/guide/{name}`. The `tableau-d3` route exists in the file but is commented out in the sidebar nav.

### Styling

Tailwind CSS for all layout and page structure. SCSS for component-specific overrides. No custom CSS for chart page structure — use Tailwind utilities only.

### Deployment

Deployed to Vercel at **https://d3-lab.vercel.app**. Config in `vercel.json` — rewrites all paths to `index.html` for SPA routing. Build command is `npx ng build --configuration production`.
