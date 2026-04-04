import { Component, ElementRef, EventEmitter, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { CodeBlockComponent } from '../../shared/components/code-block/code-block.component';
import {
  ChartTooltipComponent,
  TooltipState,
  emptyTooltip,
} from '../../shared/components/chart-tooltip/chart-tooltip.component';
import * as d3 from 'd3';
import { initSvg, attachClick, drawLegend, LegendItem, observeResize } from '../../core/utils/d3.helpers';
import { ChartClickEvent } from '../../core/models';

interface LineDatum {
  month: string;
  value: number;
}

interface Series {
  name: string;
  values: LineDatum[];
}

@Component({
  selector: 'app-d3-line',
  standalone: true,
  imports: [CodeBlockComponent, ChartTooltipComponent],
  templateUrl: './d3-line.component.html',
  styleUrl: './d3-line.component.scss',
})
export class D3LineComponent implements OnInit, OnDestroy {
  @ViewChild('chart', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;
  @ViewChild('chartContainer', { static: true }) private containerRef!: ElementRef<HTMLDivElement>;
  @Output() dotClick = new EventEmitter<ChartClickEvent<LineDatum>>();

  tooltip: TooltipState = emptyTooltip();

  curveOptions: { key: string; label: string; curve: d3.CurveFactory }[] = [
    { key: 'monotoneX', label: 'Smooth', curve: d3.curveMonotoneX },
    { key: 'linear', label: 'Straight', curve: d3.curveLinear },
    { key: 'step', label: 'Step', curve: d3.curveStep },
    { key: 'basis', label: 'Basis', curve: d3.curveBasis },
    { key: 'cardinal', label: 'Cardinal', curve: d3.curveCardinal },
  ];
  activeCurve = 'monotoneX';

  private destroyResize?: () => void;

  private months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

  private series: Series[] = [
    { name: 'Revenue', values: [30, 55, 40, 70, 50, 90].map((v, i) => ({ month: this.months[i], value: v })) },
    { name: 'Cost',    values: [20, 30, 25, 40, 35, 55].map((v, i) => ({ month: this.months[i], value: v })) },
    { name: 'Profit',  values: [10, 25, 15, 30, 15, 35].map((v, i) => ({ month: this.months[i], value: v })) },
  ];

  dataModelCode = `interface LineDatum {
  month: string;   // → scalePoint domain (x-axis)
  value: number;   // → scaleLinear domain (y-axis)
}

interface Series {
  name: string;          // legend label + color key
  values: LineDatum[];   // one line per series
}`;

  lineGenCode = `// d3.line() generates the SVG 'd' attribute for <path>
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
});`;

  dotsCode = `// Add data point circles for each series
series.forEach(s => {
  svg.selectAll(\`.dot-\${s.name}\`)
    .data(s.values)
    .join('circle')
    .attr('cx', d => xScale(d.month))
    .attr('cy', d => yScale(d.value))
    .attr('r', 4)
    .attr('fill', color(s.name));
});`;

  gridCode = `// Horizontal grid lines using axisLeft with extended ticks
svg.append('g')
  .attr('stroke', '#e0e0e0')
  .call(d3.axisLeft(y)
    .tickSize(-width)      // extend tick lines across chart
    .tickFormat(() => '')   // hide labels (the real axis draws them)
  );`;

  tooltipCode = `// Line chart: manual mouse handlers to aggregate ALL series
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
});`;

  resizeCode = `// observeResize() wraps ResizeObserver with debounce
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
}`;

  legendCode = `// Horizontal legend at top — drawLegend with layout + onHighlight
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
});`;

  ngOnInit(): void {
    this.draw();
    this.destroyResize = observeResize(this.containerRef.nativeElement, () => this.draw());
  }

  ngOnDestroy(): void {
    this.destroyResize?.();
  }

  setCurve(key: string): void {
    this.activeCurve = key;
    this.draw();
  }

  private draw(): void {
    const svgEl = this.svgRef.nativeElement;
    d3.select(svgEl).selectAll('*').remove();

    const containerWidth = this.containerRef.nativeElement.clientWidth - 48;
    const totalWidth = Math.max(400, containerWidth);
    const margin = { top: 40, right: 20, bottom: 40, left: 50 };
    const { g: svg, width, height } = initSvg(svgEl, totalWidth, 350, margin);

    const color = d3.scaleOrdinal<string>().domain(this.series.map((s) => s.name)).range(d3.schemeTableau10);

    const x = d3.scalePoint().domain(this.months).range([0, width]);

    const allValues = this.series.flatMap((s) => s.values.map((v) => v.value));
    const y = d3.scaleLinear().domain([0, d3.max(allValues) ?? 100]).nice().range([height, 0]);

    svg.append('g')
      .attr('stroke', '#e0e0e0')
      .call(d3.axisLeft(y).tickSize(-width).tickFormat(() => ''));

    svg.append('g').attr('transform', `translate(0,${height})`).call(d3.axisBottom(x));
    svg.append('g').call(d3.axisLeft(y));

    const activeCurveFactory = this.curveOptions.find(o => o.key === this.activeCurve)?.curve ?? d3.curveMonotoneX;

    const line = d3
      .line<LineDatum>()
      .x((d) => x(d.month) ?? 0)
      .y((d) => y(d.value))
      .curve(activeCurveFactory);

    this.series.forEach((s) => {
      svg
        .append('path')
        .datum(s.values)
        .attr('class', `series-path series-${s.name}`)
        .attr('fill', 'none')
        .attr('stroke', color(s.name))
        .attr('stroke-width', 2.5)
        .attr('d', line);

      const dots = svg
        .selectAll<SVGCircleElement, LineDatum>(`.dot-${s.name}`)
        .data(s.values)
        .join('circle')
        .attr('class', `series-dot series-${s.name}`)
        .attr('cx', (d) => x(d.month) ?? 0)
        .attr('cy', (d) => y(d.value))
        .attr('r', 4)
        .attr('fill', color(s.name))
        .style('cursor', 'pointer')
        .on('mouseover', (event: MouseEvent, d: LineDatum) => {
          this.tooltip = {
            visible: true,
            x: event.offsetX,
            y: event.offsetY,
            title: d.month,
            rows: this.series.map((sr) => ({
              color: color(sr.name),
              label: sr.name,
              value: sr.values.find((v) => v.month === d.month)?.value ?? 0,
            })),
          };
          d3.select(event.currentTarget as SVGCircleElement)
            .attr('r', 7)
            .attr('stroke', '#fff')
            .attr('stroke-width', 2);
        })
        .on('mousemove', (event: MouseEvent) => {
          this.tooltip = { ...this.tooltip, x: event.offsetX, y: event.offsetY };
        })
        .on('mouseleave', (event: MouseEvent) => {
          this.tooltip = emptyTooltip();
          d3.select(event.currentTarget as SVGCircleElement)
            .attr('r', 4)
            .attr('stroke', 'none');
        });

      attachClick(dots, (e) => this.dotClick.emit(e));
    });

    const root = d3.select(svgEl);
    const legendItems: LegendItem[] = this.series.map(s => ({ label: s.name, color: color(s.name) }));
    drawLegend(root, legendItems, margin.left, 12, {
      style: 'line',
      layout: 'horizontal',
      onHighlight: (highlighted) => {
        this.series.forEach((s) => {
          const isActive = highlighted === null || s.name === highlighted;
          svg.selectAll(`.series-${s.name}`)
            .transition().duration(300)
            .style('opacity', isActive ? 1 : 0.12);
        });
      },
    });
  }
}
