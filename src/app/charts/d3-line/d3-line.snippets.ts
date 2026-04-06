export const LINE_SNIPPETS = {
  dataModel: `interface LineDatum {
  month: string;   // → scalePoint domain (x-axis)
  value: number;   // → scaleLinear domain (y-axis)
}

interface Series {
  name: string;          // legend label + color key
  values: LineDatum[];   // one line per series
}`,

  lineGen: `// d3.line() generates the SVG 'd' attribute for <path>
// Curve type is configurable — toggle between interpolation styles
const curveMap = {
  monotoneX: d3.curveMonotoneX,  // smooth, preserves monotonicity
  linear:    d3.curveLinear,     // straight segments
  step:      d3.curveStep,       // step function
  basis:     d3.curveBasis,      // B-spline (may not pass through points)
  cardinal:  d3.curveCardinal,   // cardinal spline with tension
};

const line = d3.line<LineDatum>()
  .x(d => x(d.month))
  .y(d => y(d.value))
  .curve(curveMap[activeCurve]);

// Render one <path> per series
series.forEach(s => {
  svg.append('path')
    .datum(s.values)
    .attr('fill', 'none')
    .attr('stroke', color(s.name))
    .attr('stroke-width', 2.5)
    .attr('d', line);
});`,

  dots: `// Add data point circles for each series
series.forEach(s => {
  svg.selectAll(\`.dot-\${s.name}\`)
    .data(s.values)
    .join('circle')
    .attr('cx', d => xScale(d.month))
    .attr('cy', d => yScale(d.value))
    .attr('r', 4)
    .attr('fill', color(s.name));
});`,

  grid: `// Horizontal grid lines using axisLeft with extended ticks
svg.append('g')
  .attr('stroke', '#e0e0e0')
  .call(d3.axisLeft(y)
    .tickSize(-width)      // extend tick lines across chart
    .tickFormat(() => '')   // hide labels (the real axis draws them)
  );`,

  tooltip: `// Line chart: manual mouse handlers to aggregate ALL series
// at the hovered x-value (not just the hovered series)
dots.on('mouseover', (event, d) => {
  this.tooltip = {
    visible: true,
    x: event.offsetX,
    y: event.offsetY,
    title: d.month,
    // Show every series value at this month
    rows: series.map(s => ({
      color: color(s.name),
      label: s.name,
      value: s.values.find(v => v.month === d.month)?.value ?? 0,
    })),
  };
  d3.select(event.currentTarget)
    .attr('r', 7).attr('stroke', '#fff').attr('stroke-width', 2);
})
.on('mousemove', (event) => {
  this.tooltip = { ...this.tooltip, x: event.offsetX, y: event.offsetY };
})
.on('mouseleave', (event) => {
  this.tooltip = emptyTooltip();
  d3.select(event.currentTarget).attr('r', 4).attr('stroke', 'none');
});`,

  resize: `// observeResize() wraps ResizeObserver with debounce
// All charts use this pattern: clear SVG → re-draw at new size
import { observeResize } from '../../core/utils/d3.helpers';

ngOnInit() {
  this.draw();
  this.destroyResize = observeResize(
    this.containerRef.nativeElement,
    () => this.draw(),    // callback on resize
    200,                  // debounce ms
  );
}

ngOnDestroy() {
  this.destroyResize?.();  // clean up observer
}

private draw(): void {
  // 1. Clear previous render
  d3.select(svgEl).selectAll('*').remove();

  // 2. Read container width (minus padding)
  const containerWidth = this.containerRef.nativeElement.clientWidth - 48;
  const totalWidth = Math.max(400, containerWidth);

  // 3. Re-create scales, axes, elements at new width
  const { g: svg, width, height } = initSvg(svgEl, totalWidth, 350, margin);
  // ... rest of chart rendering
}`,

  legend: `// Horizontal legend at top — drawLegend with layout + onHighlight
const legendItems = series.map(s => ({
  label: s.name,
  color: color(s.name),
}));

drawLegend(root, legendItems, margin.left, 12, {
  style: 'line',           // line swatch instead of rect
  layout: 'horizontal',    // single row
  onHighlight: (highlighted) => {
    series.forEach(s => {
      const isActive = highlighted === null || s.name === highlighted;
      svg.selectAll(\`.series-\${s.name}\`)
        .transition().duration(300)
        .style('opacity', isActive ? 1 : 0.12);
    });
  },
});`,
};
