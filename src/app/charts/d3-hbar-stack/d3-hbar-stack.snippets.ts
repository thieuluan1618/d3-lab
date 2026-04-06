export const HBAR_STACK_SNIPPETS = {
  dataModel: `interface StackDatum {
  label: string;       // company / row label
  promoters: number;   // % promoters
  neutrals: number;    // % neutrals
  detractors: number;  // % detractors
}`,

  stack: `// d3.stack() transforms flat rows into layered series
const stack = d3.stack<StackDatum>()
  .keys(['promoters', 'neutrals', 'detractors']);

const series = stack(data);
// series[0] = promoters layer  → [[0, 48.8], [0, 50.5], ...]
// series[1] = neutrals layer   → [[48.8, 79.5], ...]
// series[2] = detractors layer → [[79.5, 100], ...]`,

  render: `// Each series layer becomes a <g>, each datum a <rect>
svg.selectAll('g.layer')
  .data(series)
  .join('g')
    .attr('fill', d => color(d.key))
  .selectAll('rect')
  .data(d => d)
  .join('rect')
    .attr('y', d => y(d.data.label))
    .attr('x', d => x(d[0]))
    .attr('width', d => x(d[1]) - x(d[0]))
    .attr('height', y.bandwidth());

// Inline labels — only when segment is wide enough
layer.append('text')
  .filter(d => x(d[1]) - x(d[0]) > 30)
  .text(d => \`\${(d[1] - d[0]).toFixed(1)}%\`);`,

  tooltip: `// Show all three segments in tooltip rows with color dots
attachTooltip(rects, callbacks, (d) => ({
  title: d.data.label,
  rows: [
    { color: '#22c55e', label: 'Promoters',  value: d.data.promoters },
    { color: '#eab308', label: 'Neutrals',   value: d.data.neutrals },
    { color: '#f97316', label: 'Detractors', value: d.data.detractors },
  ],
}));`,
};
