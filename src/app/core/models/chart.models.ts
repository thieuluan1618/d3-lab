// ---------------------------------------------------------------------------
// RAW / DOMAIN MODEL
// What comes from the API — never mutated, passed into transform services
// ---------------------------------------------------------------------------

export interface MetricRecord {
  date: string;         // ISO string, e.g. "2024-01-01"
  value: number;
  metadata?: Record<string, unknown>;
}

export interface PeriodData {
  period: string;       // e.g. "2024-Q1", "2024", "Jan 2024"
  records: MetricRecord[];
}

// ---------------------------------------------------------------------------
// CHART CONFIG MODEL
// Describes HOW to render — chart type, axis keys, display options
// Equivalent to Tableau's "Marks card + Shelf configuration"
// ---------------------------------------------------------------------------

export type ChartType = 'bar' | 'hbar' | 'hbar-group' | 'hbar-stack' | 'line' | 'pie' | 'area' | 'scatter';

export type ScaleType = 'band' | 'point' | 'time' | 'linear' | 'log' | 'sqrt';

export interface AxisConfig {
  label?: string;               // axis label text
  format?: string;              // d3-format string, e.g. ',.0f', '.1%', '%b %Y'
  scaleType?: ScaleType;        // override auto-detection
  ticks?: number;               // suggested tick count
  tickRotation?: number;        // degrees, e.g. -45 for angled labels
}

export interface DualAxisConfig {
  yRightKey: string;            // field mapped to right y-axis
  yRightLabel?: string;
  yRightFormat?: string;
  yRightScaleType?: ScaleType;
}

export type LegendPosition = 'right' | 'bottom' | 'top' | 'none';

export interface ChartConfig {
  type: ChartType;
  title: string;
  subtitle?: string;

  // Field mapping — which keys in ChartPoint map to axes
  xKey: string;
  yKey: string;

  // Axis configuration
  xAxis?: AxisConfig;           // Tableau: Columns shelf settings
  yAxis?: AxisConfig;           // Tableau: Rows shelf settings
  dualAxis?: DualAxisConfig;    // Tableau: dual-axis worksheet

  // Color
  colorScheme?: string[];       // custom palette, defaults to schemeTableau10
  colorKey?: string;            // field that drives color encoding

  // Dimensions
  margin?: ChartMargin;
  width?: number;
  height?: number;

  // Display toggles
  showGrid?: boolean;           // horizontal grid lines
  showValueLabels?: boolean;    // value text on bars / points
  showDataPoints?: boolean;     // dots on line charts

  // Legend
  legendPosition?: LegendPosition;

  // Interaction
  enableTooltip?: boolean;      // default true
  enableHighlight?: boolean;    // legend click → highlight series
  enableBrush?: boolean;        // x-axis brush for zoom/filter
  enableZoom?: boolean;         // scroll to zoom

  // Line-specific
  curveType?: 'linear' | 'monotoneX' | 'step' | 'basis' | 'cardinal';
  fillArea?: boolean;           // fill area under line

  // Bar-specific
  barPadding?: number;          // 0–1, spacing between bars
  barRadius?: number;           // border-radius on bar tops

  // Pie-specific
  innerRadius?: number;         // 0 = pie, > 0 = donut (as % of outer radius)
}

export interface ChartMargin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// ---------------------------------------------------------------------------
// CHART DATA MODEL
// Transformed data ready for D3 — decoupled from raw API shape.
// One ChartSeries per line/bar-group/pie — multiple for multi-period views.
// Equivalent to Tableau's "individual marks" on the canvas.
// ---------------------------------------------------------------------------

export interface ChartPoint {
  x: string | Date | number;
  y: number;
  label?: string;           // optional display label on the point
  raw?: MetricRecord;       // back-reference to original record for tooltips
}

export interface ChartSeries {
  id: string;               // unique key, e.g. "revenue-2024"
  label: string;            // display name in legend/tooltip
  period: string;           // "2024", "2023" — drives multi-period comparison
  color?: string;
  points: ChartPoint[];
}

// ---------------------------------------------------------------------------
// TOOLTIP MODEL
// Aggregates everything needed to render a tooltip at a given x position.
// Equivalent to Tableau's built-in tooltip with custom fields.
// ---------------------------------------------------------------------------

export interface TooltipContext {
  x: string | Date | number;     // hovered x value
  series: TooltipSeries[];        // one entry per visible series at this x
  position: { left: number; top: number };
}

export interface TooltipSeries {
  id: string;
  label: string;
  period: string;
  value: number;
  delta?: number;               // absolute diff vs previous period
  deltaPercent?: number;        // % diff vs previous period
  color: string;
  raw?: MetricRecord;
}

// ---------------------------------------------------------------------------
// CHART CLICK EVENT
// Emitted when a user clicks a chart element (bar, slice, dot, etc.)
// ---------------------------------------------------------------------------

export interface ChartClickEvent<T = unknown> {
  datum: T;
  event: MouseEvent;
}

// ---------------------------------------------------------------------------
// CHART VIEW MODEL
// Top-level model for a dashboard panel — ties config + data + UI state.
// Equivalent to a single Tableau worksheet.
// ---------------------------------------------------------------------------

export interface ChartView {
  id: string;
  config: ChartConfig;
  periods: string[];            // all available periods, e.g. ["2024", "2023"]
  series: ChartSeries[];        // all series (all periods)
  activePeriods: string[];      // user-selected visible periods
  tooltip: TooltipContext | null;
}
