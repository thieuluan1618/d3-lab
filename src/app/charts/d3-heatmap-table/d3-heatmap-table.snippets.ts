export const HEATMAP_TABLE_SNIPPETS = {
  apiContract: `// BE response — segments are top-level and own their own flat data[].
// columns[] is a deduped lookup table shared by all segments. The FE nests
// each segment's data via ChartTransformService.heatmapResponseToChart().
interface ApiHeatmapResponse {
  id: string;
  serviceLine: string;            // "Mental Health"
  category: string;               // "Familiarity"
  question: string;               // survey question text
  columns: ApiHeatmapColumn[];    // shared lookup, deduped
  segments: ApiHeatmapSegment[];  // display order honored
}

interface ApiHeatmapColumn {
  key: string;                    // "very_fam"
  label: string;                  // "Very familiar"
  order: number;                  // 1-based sort order
}

interface ApiHeatmapSegment {
  id: string;                     // "seg-mental-health"
  label: string;                  // "Term: Mental Health"
  data: ApiHeatmapDataPoint[];    // flat records for this segment only
}

interface ApiHeatmapDataPoint {
  marketType: string;             // "cbsa" | "national" | "state" | "dma"
  marketName: string;             // "Green Bay WI CBSA", "National"
  year: number;
  columnKey: string;              // FK → ApiHeatmapColumn.key
  value: number | null;           // null = suppressed / no data
  sampleSize: number;             // respondent count (n)
}`,

  dataModel: `// UI model produced by ChartTransformService — consumed by the component
interface HeatmapChart {
  id: string;
  serviceLine: string;
  category: string;
  question: string;
  years: number[];              // distinct years, ascending
  segments: HeatmapSegment[];   // one table per segment
}

interface HeatmapSegment {
  id: string;
  label: string;
  columns: HeatmapColumn[];     // sorted by order
  groups: HeatmapGroup[];       // one per market
}

interface HeatmapGroup {
  marketType: string;           // "cbsa", "national", "state", "dma"
  marketName: string;           // "Green Bay WI CBSA", "National"
  rows: HeatmapRow[];           // one per year
}

interface HeatmapRow {
  year: number;
  cells: HeatmapCell[];
}

interface HeatmapCell {
  columnKey: string;
  value: number | null;
  displayValue?: string;        // "29.33%"
  sampleSize?: number;
}`,

  transform: `// ChartTransformService — API response → nested UI model
heatmapResponseToChart(response: ApiHeatmapResponse): HeatmapChart {
  const sortedColumns = [...response.columns].sort((a, b) => a.order - b.order);
  const yearsSet = new Set<number>();

  // For each segment, group its own flat data: marketName → year → cells
  const segments = response.segments.map((segMeta) => {
    const marketMap = new Map<string, GroupAccum>();

    for (const d of segMeta.data) {
      yearsSet.add(d.year);
      const grp = getOrCreate(marketMap, d.marketName, () => ({ marketType: d.marketType, rows: new Map() }));
      const cells = getOrCreate(grp.rows, d.year, () => []);
      cells.push({
        columnKey: d.columnKey,
        value: d.value,
        displayValue: d.value !== null ? \`\${d.value.toFixed(2)}%\` : undefined,
        sampleSize: d.sampleSize,
      });
    }

    return { id: segMeta.id, label: segMeta.label, columns: sortedColumns, groups: toGroups(marketMap) };
  });

  return {
    id: response.id,
    serviceLine: response.serviceLine,
    category: response.category,
    question: response.question,
    years: [...yearsSet].sort((a, b) => a - b),
    segments,
  };
}`,

  colorScale: `// Collect all non-null values across segments
const values: number[] = [];
for (const seg of chart.segments)
  for (const group of seg.groups)
    for (const row of group.rows)
      for (const cell of row.cells)
        if (cell.value !== null) values.push(cell.value);

// Build sequential orange scale
const colorScale = d3.scaleSequential(d3.interpolateOranges)
  .domain([0, d3.max(values)]);

// Background + auto-contrast text
const bg = colorScale(cell.value);
const textColor = cell.value / max > 0.55 ? '#fff' : '#1e293b';`,

  render: `<!-- One table per segment -->
@for (segment of chart.segments; track segment.id) {
  <div class="segment-header">{{ segment.label }}</div>
  <table>
    <thead>
      <tr>
        <th>Market</th>
        <th>Year</th>
        @for (col of segment.columns; track col.key) {
          <th>{{ col.label }}</th>
        }
      </tr>
    </thead>
    <tbody>
      @for (group of segment.groups; track group.marketName) {
        @for (row of group.rows; track row.year; let ri = $index) {
          <tr>
            <!-- rowspan merges market across years -->
            @if (ri === 0) {
              <td [attr.rowspan]="group.rows.length">
                <div class="market-type">{{ group.marketType }}</div>
                {{ group.marketName }}
              </td>
            }
            <td>{{ row.year }}</td>
            @for (col of segment.columns; track col.key) {
              <td [ngStyle]="{
                'background-color': getCellBg(cell),
                'color': getCellTextColor(cell)
              }">
                {{ formatValue(cell) }}
              </td>
            }
          </tr>
        }
      }
    </tbody>
  </table>
}`,
};
