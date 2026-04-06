export const PIE_SNIPPETS = {
  dataModel: `interface PieDatum {
  label: string;   // slice name → scaleOrdinal domain
  value: number;   // slice size → d3.pie() value accessor
}`,

  layout: `// d3.pie() computes start/end angles from values
const pie = d3.pie<PieDatum>()
  .value(d => d.value);

// d3.arc() converts angles to SVG <path> 'd' attribute
const arc = d3.arc<d3.PieArcDatum<PieDatum>>()
  .innerRadius(0)        // 0 = pie, > 0 = donut
  .outerRadius(radius);

// Label arc — positions text at 62% of radius
const labelArc = d3.arc<d3.PieArcDatum<PieDatum>>()
  .innerRadius(radius * 0.62)
  .outerRadius(radius * 0.62);`,

  render: `// Create one <g> per slice, each containing path + text
const arcs = svg.selectAll('arc')
  .data(pie(data))
  .join('g');

// Draw the slice
arcs.append('path')
  .attr('d', arc)
  .attr('fill', d => color(d.data.label))
  .attr('stroke', 'white');

// Position label at centroid of label arc
arcs.append('text')
  .attr('transform', d => \`translate(\${labelArc.centroid(d)})\`)
  .text(d => \`\${d.data.value}%\`);`,

  tooltip: `// Reusable helper wires mouseover / mousemove / mouseleave
attachTooltip(arcs.select('path'), {
  onUpdate: (state) => {
    if (state.visible && !state.title) {
      this.tooltip = { ...this.tooltip, x: state.x, y: state.y };
    } else {
      this.tooltip = state;
    }
  },
}, (d) => ({
  title: d.data.label,
  rows: [{ color: color(d.data.label), label: 'Share', value: d.data.value + '%' }],
}));

// Template — project custom Angular content via <ng-content>
// <app-chart-tooltip [state]="tooltip">
//   <app-sparkline [data]="trendData" />
// </app-chart-tooltip>`,
};
