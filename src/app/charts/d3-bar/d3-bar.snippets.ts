export const BAR_SNIPPETS = {
  dataModel: `interface BarDatum {
  label: string;   // → scaleBand domain (x-axis)
  value: number;   // → scaleLinear domain (y-axis)
}`,

  scales: `// X-axis: categorical → evenly spaced bands
const x = d3.scaleBand()
  .domain(data.map(d => d.label))
  .range([0, width])
  .padding(0.3);

// Y-axis: numeric → pixel range (inverted)
const y = d3.scaleLinear()
  .domain([0, d3.max(data, d => d.value)])
  .nice()
  .range([height, 0]);`,

  render: `// Bind data to <rect> elements using join pattern
svg.selectAll('.bar')
  .data(data)
  .join('rect')
  .attr('x', d => x(d.label))
  .attr('y', d => y(d.value))
  .attr('width', x.bandwidth())
  .attr('height', d => height - y(d.value))
  .attr('fill', 'steelblue');`,

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
  title: d.label,
  rows: [{ label: 'Value', value: d.value }],
}));

// Template — project custom Angular content via <ng-content>
// <app-chart-tooltip [state]="tooltip">
//   <my-custom-component [data]="extraData" />
// </app-chart-tooltip>`,
};
