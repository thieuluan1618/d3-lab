export const BULLET_SNIPPETS = {
  dataModel: `interface BulletDatum {
  label: string;   // → scaleBand domain (y-axis)
  value: number;   // → scaleLinear domain (x-axis)
}`,

  track: `// Background track rects — full width, light gray
svg.selectAll('.track')
  .data(data)
  .join('rect')
  .attr('class', 'track')
  .attr('x', 0)
  .attr('y', d => y(d.label))
  .attr('width', width)
  .attr('height', y.bandwidth())
  .attr('fill', '#e2e8f0')
  .attr('rx', 3);`,

  render: `// Value bars on top of tracks
svg.selectAll('.bar')
  .data(data)
  .join('rect')
  .attr('class', 'bar')
  .attr('x', 0)
  .attr('y', d => y(d.label))
  .attr('width', d => x(d.value))
  .attr('height', y.bandwidth())
  .attr('fill', '#3b82f6')
  .attr('rx', 3);

// Value labels at the end of each bar
svg.selectAll('.label')
  .data(data)
  .join('text')
  .attr('x', d => x(d.value) + 4)
  .attr('y', d => y(d.label) + y.bandwidth() / 2)
  .attr('dy', '0.35em')
  .attr('font-size', '12px')
  .text(d => d.value.toFixed(1));`,

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
  rows: [{ label: 'Index Score', value: d.value }],
}));`,

  referenceLine: `// Dashed vertical reference line at index = 100
svg.append('line')
  .attr('x1', x(100)).attr('x2', x(100))
  .attr('y1', 0).attr('y2', height)
  .attr('stroke', '#94a3b8')
  .attr('stroke-width', 1)
  .attr('stroke-dasharray', '4 3');

svg.append('text')
  .attr('x', x(100))
  .attr('y', -6)
  .attr('text-anchor', 'middle')
  .attr('font-size', '11px')
  .attr('fill', '#64748b')
  .text('Index 100');`,
};
