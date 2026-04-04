# D3 Handbook — LLM Context

> This file gives AI assistants (Claude Code, Copilot, Cursor, etc.) deep context
> about our D3 + Angular chart codebase. Place it in your project root or reference
> it in your CLAUDE.md.

## Stack

- **Angular 18** — standalone components, signals, lazy-loaded routes
- **D3.js v7** — no wrapper libraries, raw D3 selections
- **Tailwind CSS** — utility-first styling
- **highlight.js** — code syntax highlighting (direct, not ngx-highlightjs)

## Project Layout

```
src/app/
├── core/
│   ├── models/chart.models.ts     # All chart interfaces (5-layer architecture)
│   ├── utils/d3.helpers.ts        # Shared D3 utilities (initSvg, tooltip, legend, resize)
│   └── services/                  # ChartTransformService (data transforms)
├── charts/                        # One component per chart type
│   ├── d3-bar/
│   ├── d3-pie/
│   ├── d3-line/
│   ├── d3-hbar-group/
│   ├── d3-hbar-stack/
│   └── d3-bullet/
├── shared/components/
│   ├── chart-tooltip/             # Reusable tooltip (Angular component, not D3)
��   ├── code-block/                # Syntax-highlighted code snippets
│   └── sidebar/                   # Navigation
└── pages/                         # Guide/documentation pages
```

## 5-Layer Data Architecture

This is the core mental model. Every chart follows these layers:

```
Layer 1: Raw/Domain (MetricRecord, PeriodData)
   ↓  ChartTransformService — never transform inside components
Layer 2: ChartConfig — HOW to render (type, axes, colors, toggles)
   ↓
Layer 3: ChartSeries / ChartPoint — transformed data ready for D3
   ↓
Layer 4: TooltipContext / TooltipSeries — tooltip state at hovered position
   ↓
Layer 5: ChartView — ties config + data + UI state for a dashboard panel
```

### Key interfaces (chart.models.ts)

```typescript
interface MetricRecord { date: string; value: number; metadata?: Record<string, unknown>; }
interface PeriodData   { period: string; records: MetricRecord[]; }

interface ChartConfig {
  type: ChartType;          // 'bar' | 'hbar' | 'hbar-group' | 'hbar-stack' | 'line' | 'pie' | 'area' | 'scatter'
  title: string;
  xKey: string;             // field mapped to x-axis
  yKey: string;             // field mapped to y-axis
  xAxis?: AxisConfig;       // label, format, scaleType, ticks, tickRotation
  yAxis?: AxisConfig;
  dualAxis?: DualAxisConfig;
  colorScheme?: string[];   // custom palette, defaults to schemeTableau10
  colorKey?: string;        // field driving color encoding
  margin?: ChartMargin;
  showGrid?: boolean;
  showValueLabels?: boolean;
  showDataPoints?: boolean;
  legendPosition?: LegendPosition;
  enableTooltip?: boolean;
  enableHighlight?: boolean;
  enableBrush?: boolean;
  enableZoom?: boolean;
  curveType?: 'linear' | 'monotoneX' | 'step' | 'basis' | 'cardinal';
  fillArea?: boolean;
  barPadding?: number;
  barRadius?: number;
  innerRadius?: number;     // 0 = pie, > 0 = donut
}

interface ChartPoint  { x: string | Date | number; y: number; label?: string; raw?: MetricRecord; }
interface ChartSeries { id: string; label: string; period: string; color?: string; points: ChartPoint[]; }

interface TooltipContext { x: string | Date | number; series: TooltipSeries[]; position: { left: number; top: number }; }
interface ChartView     { id: string; config: ChartConfig; periods: string[]; series: ChartSeries[]; activePeriods: string[]; tooltip: TooltipContext | null; }
```

## Chart Component Pattern

Every chart component follows this exact structure:

```typescript
export class D3FooComponent implements OnInit, OnDestroy {
  @ViewChild('chart', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;
  @ViewChild('chartContainer', { static: true }) private containerRef!: ElementRef<HTMLDivElement>;
  @Output() barClick = new EventEmitter<ChartClickEvent<FooDatum>>();

  tooltip: TooltipState = emptyTooltip();
  private destroyResize?: () => void;

  ngOnInit(): void {
    this.draw();
    this.destroyResize = observeResize(this.containerRef.nativeElement, () => this.draw());
  }

  ngOnDestroy(): void {
    this.destroyResize?.();
  }

  private draw(): void {
    const svgEl = this.svgRef.nativeElement;
    d3.select(svgEl).selectAll('*').remove();  // clear before re-draw

    const containerWidth = this.containerRef.nativeElement.clientWidth - 48; // p-6 padding
    const totalWidth = Math.max(400, containerWidth);
    const margin = { top: 20, right: 20, bottom: 40, left: 50 };
    const { g: svg, width, height } = initSvg(svgEl, totalWidth, 350, margin);

    // 1. Create scales
    // 2. Draw axes
    // 3. Render marks (rects, paths, arcs, etc.)
    // 4. Attach tooltip: attachTooltip(selection, callbacks, buildRows)
    // 5. Attach click: attachClick(selection, handler)
    // 6. Draw legend: drawLegend(container, items, x, y, { onHighlight })
  }
}
```

### HTML template pattern

```html
<div #chartContainer class="relative mb-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
  <!-- Optional toggles (grid, curve type, etc.) -->
  <svg #chart></svg>
  <app-chart-tooltip [state]="tooltip" />
</div>
```

## Shared Helpers (d3.helpers.ts)

### initSvg(el, totalWidth, totalHeight, margin) → SvgContainer
Applies D3 margin convention. Returns `{ root, g, width, height }`.
- `root` = the `<svg>` selection (for legends placed outside the margin)
- `g` = the inner `<g>` translated by margin (all chart content goes here)

### observeResize(el, callback, debounceMs?) → cleanup function
Wraps `ResizeObserver` with debounce. Call in `ngOnInit`, store return value, call in `ngOnDestroy`.
Callback receives `(width, height)`. Only fires when both > 0.

### attachTooltip(selection, callbacks, buildRows)
Wires `mouseover` / `mousemove` / `mouseleave` on a D3 selection.
- `callbacks.onUpdate(state: TooltipState)` — drives the Angular tooltip component
- `buildRows(datum)` — returns `{ title, rows: TooltipRow[] }` for the hovered element
- Automatically sets opacity 0.7 on hover, resets on leave

**Exception**: Multi-series line chart uses manual mouse handlers to aggregate all series values at a given x-position (see d3-line component).

### attachClick(selection, onClick)
Wires `click` event. Emits `ChartClickEvent<Datum>` with `{ datum, event }`.

### drawLegend(container, items, x, y, options?)
Renders a legend group. Options:
- `style`: `'rect'` (default) or `'line'` (for line charts)
- `layout`: `'vertical'` (default) or `'horizontal'`
- `onHighlight(highlighted: string | null)`: callback for interactive legend

**Legend highlight behavior**: Click item → highlight that series (dim others to 12% opacity). Click same item again → reset all to full opacity. This is NOT hide/show — it's highlight/dim.

## Tooltip Component (chart-tooltip)

Angular component positioned absolutely within the chart container (`position: relative`).

```typescript
interface TooltipState {
  visible: boolean;
  x: number;           // event.offsetX
  y: number;           // event.offsetY
  title: string;
  rows: TooltipRow[];
}

interface TooltipRow {
  label: string;
  value: string | number;
  color?: string;      // optional color swatch
}

function emptyTooltip(): TooltipState  // factory for hidden state
```

Supports `<ng-content>` for projecting custom Angular components into the tooltip.

## Conventions & Rules

1. **Never mutate raw data** — transform in `ChartTransformService`, not in D3 components
2. **Never use D3 wrapper libraries** — use raw D3 selections and generators
3. **Every chart must support resize** — use `observeResize()` + `draw()` pattern
4. **Legend = highlight, not hide** — dim to 12% opacity, click again to reset
5. **Tooltip = Angular component** — not D3-rendered HTML. Driven by `TooltipState`
6. **CSS classes on D3 elements** — for legend targeting (e.g. `.series-Revenue`, `.bar-ProductA`, `.slice-Chrome`, `.layer-promoters`)
7. **Code snippet strings** — each chart has `dataModelCode`, `renderCode`, `tooltipCode`, etc. as component properties for the guide page
8. **Tailwind for layout** — chart page structure uses Tailwind classes, not custom CSS

## Tableau → D3 Mapping

| Tableau Concept | D3 Equivalent |
|----------------|---------------|
| Columns shelf (dimension) | `d3.scaleBand()` or `d3.scalePoint()` domain |
| Columns shelf (date) | `d3.scaleTime()` domain |
| Rows shelf (measure) | `d3.scaleLinear()` domain |
| Color shelf | `d3.scaleOrdinal()` + `drawLegend()` |
| Size shelf | scale mapped to radius/width |
| Label shelf | `<text>` elements positioned at mark centroids |
| Filters | Service-layer filtering before chart component |
| Parameters | Angular `@Input()` properties |
| Reference line | `svg.append('line')` with dashed stroke |
| Dual axis | Two y-scales, `d3.axisLeft()` + `d3.axisRight()` |
| Pages shelf | Multi-period `ChartSeries[]`, small multiples |
| LOD expressions | `d3.rollup()` pre-aggregation in transform service |
| Stack marks | `d3.stack()` layout |
| Tooltips | `ChartTooltipComponent` + `attachTooltip()` |

## Common D3 Patterns We Use

### Scales
- `scaleBand()` — categorical axes with bars (padding 0.2–0.3)
- `scalePoint()` — categorical axes for line charts (no bands)
- `scaleLinear()` — numeric axes, always call `.nice()`
- `scaleOrdinal(schemeTableau10)` — color by category
- Nested `scaleBand()` — grouped bars (outer for groups, inner for sub-items)

### Layouts
- `d3.stack()` — stacked bars/areas, transforms flat data to [start, end] layers
- `d3.pie()` + `d3.arc()` — pie/donut charts
- `d3.line()` with `.curve()` — line charts with configurable interpolation

### Configurable curves
```typescript
const curveMap: Record<string, d3.CurveFactory> = {
  monotoneX: d3.curveMonotoneX,  // smooth, preserves monotonicity
  linear:    d3.curveLinear,     // straight segments
  step:      d3.curveStep,       // step function
  basis:     d3.curveBasis,      // B-spline
  cardinal:  d3.curveCardinal,   // cardinal spline with tension
};
```

### Grid lines
```typescript
// Horizontal grid: second axis with extended ticks, no labels
svg.append('g')
  .attr('stroke', '#e0e0e0')
  .call(d3.axisLeft(y).tickSize(-width).tickFormat(() => ''));
```

### Grid toggle (bullet, hbar-stack)
Wrap grid elements in a `<g class="grid-lines">`, toggle with `.attr('display', show ? null : 'none')`.

## Adding a New Chart

1. `npx ng generate component charts/d3-{name} --standalone --skip-tests`
2. Define data interface (`interface FooDatum { ... }`)
3. Implement `OnInit, OnDestroy` with the draw() + observeResize() pattern
4. Use helpers: `initSvg`, `attachTooltip`, `attachClick`, `drawLegend`
5. Add CSS classes on D3 elements for legend targeting
6. Add code snippet properties for the guide page
7. Create HTML template: header → Tableau equivalent box → chart card → code sections → concepts grid
8. Add route to `app.routes.ts` (lazy-loaded)
9. Add sidebar nav item in `sidebar.component.ts`
