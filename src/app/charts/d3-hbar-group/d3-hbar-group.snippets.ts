export const HBAR_GROUP_SNIPPETS = {
  dataModel: `interface GroupDatum {
  group: string;                      // primary category (y-axis)
  [key: string]: string | number;     // dynamic subgroup values
}

// Multi-period: wrap each period's data with a label
interface PeriodData {
  label: string;        // e.g. '2024', '2025'
  data: GroupDatum[];
}

const subgroups = ['ProductA', 'ProductB', 'ProductC'];`,

  scales: `// Shared y-axis across all periods
const y0 = d3.scaleBand()
  .domain(groups)
  .range([0, height])
  .padding(0.25);

const y1 = d3.scaleBand()
  .domain(subgroups)
  .range([0, y0.bandwidth()])
  .padding(0.1);

// Shared x-scale — domain from max across ALL periods
const xMax = d3.max(periods, p =>
  d3.max(p.data, d => Math.max(...subgroups.map(k => d[k])))
);
const x = d3.scaleLinear()
  .domain([0, xMax]).nice()
  .range([0, panelWidth]);`,

  render: `// Render one panel per period (small multiples)
periods.forEach((period, i) => {
  const panel = svg.append('g')
    .attr('transform', \`translate(\${i * (panelWidth + gap)}, 0)\`);

  // Period title
  panel.append('text').text(period.label)
    .attr('x', panelWidth / 2).attr('y', -8);

  // Bars + value labels
  const groups = panel.selectAll('g.group')
    .data(period.data).join('g')
    .attr('transform', d => \`translate(0,\${y0(d.group)})\`);

  groups.selectAll('rect')
    .data(d => subgroups.map(key => ({ key, value: d[key] })))
    .join('rect')
    .attr('y', d => y1(d.key))
    .attr('width', d => x(d.value))
    .attr('height', y1.bandwidth())
    .attr('fill', d => color(d.key));

  // Value labels at bar ends
  groups.selectAll('text.label')
    .data(d => subgroups.map(key => ({ key, value: d[key] })))
    .join('text')
    .attr('x', d => x(d.value) + 4)
    .attr('y', d => y1(d.key) + y1.bandwidth() / 2)
    .text(d => d.value);
});`,

  tooltip: `// Reusable helper wires mouseover / mousemove / mouseleave
attachTooltip(bars, {
  onUpdate: (state) => {
    if (state.visible && !state.title) {
      this.tooltip = { ...this.tooltip, x: state.x, y: state.y };
    } else {
      this.tooltip = state;
    }
  },
}, (d) => ({
  title: d.group,
  rows: [{ color: color(d.key), label: d.key, value: d.value }],
}));

// Template — project custom Angular content via <ng-content>
// <app-chart-tooltip [state]="tooltip">
//   <my-custom-component [data]="extraData" />
// </app-chart-tooltip>`,

  label: `// Value labels — append text after each bar
groups.selectAll('text.label')
  .data(d => subgroups.map(key => ({ key, value: d[key] })))
  .join('text')
  .attr('class', 'label')
  .attr('x', d => x(d.value) + 4)       // 4px right of bar end
  .attr('y', d => y1(d.key) + y1.bandwidth() / 2)
  .attr('dominant-baseline', 'middle')
  .attr('font-size', '11px')
  .attr('fill', '#64748b')
  .text(d => d.value);`,
};
