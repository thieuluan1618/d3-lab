export const HEATMAP_TABLE_SNIPPETS = {
  dataModel: `interface HeatmapCell {
  row: string;    // row label, e.g. "Bellin Health"
  col: string;    // column label, e.g. "Loyalty Index"
  value: number;  // numeric value → drives color
}

interface HeatmapTableData {
  rows: string[];       // row labels (y-axis)
  columns: string[];    // column headers (x-axis)
  cells: HeatmapCell[]; // flat list of all cell values
}`,

  colorScale: `// Build a sequential color scale from data extent
const values = data.cells.map(c => c.value);
const colorScale = d3.scaleSequential(d3.interpolateYlOrRd)
  .domain([d3.min(values), d3.max(values)]);

// Get background color for a cell
const bg = colorScale(cell.value);

// Auto-switch text to white for dark cells
const ratio = (value - min) / (max - min);
const textColor = ratio > 0.6 ? '#fff' : '#1e293b';`,

  render: `<!-- HTML table with Angular ngStyle binding -->
<table>
  <thead>
    <tr>
      <th></th>
      @for (col of data.columns; track col) {
        <th>{{ col }}</th>
      }
    </tr>
  </thead>
  <tbody>
    @for (row of data.rows; track row) {
      <tr>
        <td>{{ row }}</td>
        @for (col of data.columns; track col) {
          <td [ngStyle]="{
            'background-color': getCellBg(row, col),
            'color': getCellTextColor(row, col)
          }">
            {{ valueFormat(getCellValue(row, col)) }}
          </td>
        }
      </tr>
    }
  </tbody>
</table>`,
};
