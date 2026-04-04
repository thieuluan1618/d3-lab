import { Component, ElementRef, EventEmitter, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { CodeBlockComponent } from '../../shared/components/code-block/code-block.component';
import {
  ChartTooltipComponent,
  TooltipState,
  emptyTooltip,
} from '../../shared/components/chart-tooltip/chart-tooltip.component';
import * as d3 from 'd3';
import { initSvg, attachTooltip, attachClick, drawLegend, LegendItem, observeResize } from '../../core/utils/d3.helpers';
import { ChartClickEvent } from '../../core/models';

interface StackDatum {
  label: string;
  promoters: number;
  neutrals: number;
  detractors: number;
}

@Component({
  selector: 'app-d3-hbar-stack',
  standalone: true,
  imports: [CodeBlockComponent, ChartTooltipComponent],
  templateUrl: './d3-hbar-stack.component.html',
  styleUrl: './d3-hbar-stack.component.scss',
})
export class D3HbarStackComponent implements OnInit, OnDestroy {
  @ViewChild('chart', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;
  @ViewChild('chartContainer', { static: true }) private containerRef!: ElementRef<HTMLDivElement>;
  @Output() barClick = new EventEmitter<ChartClickEvent<StackDatum>>();

  tooltip: TooltipState = emptyTooltip();
  showGrid = false;

  private destroyResize?: () => void;

  private data: StackDatum[] = [
    { label: 'ABC Health', promoters: 48.8, neutrals: 30.7, detractors: 20.5 },
    { label: 'Competitor A', promoters: 50.5, neutrals: 25.2, detractors: 24.3 },
    { label: 'Competitor B', promoters: 38.2, neutrals: 35.1, detractors: 26.7 },
    { label: 'Competitor C', promoters: 44.0, neutrals: 28.5, detractors: 27.5 },
  ];
  private keys = ['promoters', 'neutrals', 'detractors'];
  private colors: Record<string, string> = {
    promoters: '#22c55e',
    neutrals: '#eab308',
    detractors: '#f97316',
  };

  dataModelCode = `interface StackDatum {
  label: string;       // company / row label
  promoters: number;   // % promoters
  neutrals: number;    // % neutrals
  detractors: number;  // % detractors
}`;

  stackCode = `// d3.stack() transforms flat rows into layered series
const stack = d3.stack<StackDatum>()
  .keys(['promoters', 'neutrals', 'detractors']);

const series = stack(data);
// series[0] = promoters layer  → [[0, 48.8], [0, 50.5], ...]
// series[1] = neutrals layer   → [[48.8, 79.5], ...]
// series[2] = detractors layer → [[79.5, 100], ...]`;

  renderCode = `// Each series layer becomes a <g>, each datum a <rect>
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
  .text(d => \`\${(d[1] - d[0]).toFixed(1)}%\`);`;

  tooltipCode = `// Show all three segments in tooltip rows with color dots
attachTooltip(rects, callbacks, (d) => ({
  title: d.data.label,
  rows: [
    { color: '#22c55e', label: 'Promoters',  value: d.data.promoters },
    { color: '#eab308', label: 'Neutrals',   value: d.data.neutrals },
    { color: '#f97316', label: 'Detractors', value: d.data.detractors },
  ],
}));`;

  ngOnInit(): void {
    this.draw();
    this.destroyResize = observeResize(this.containerRef.nativeElement, () => this.draw());
  }

  ngOnDestroy(): void {
    this.destroyResize?.();
  }

  private draw(): void {
    const svgEl = this.svgRef.nativeElement;
    d3.select(svgEl).selectAll('*').remove();

    const containerWidth = this.containerRef.nativeElement.clientWidth - 48;
    const totalWidth = Math.max(400, containerWidth);
    const margin = { top: 30, right: 30, bottom: 10, left: 150 };
    const { root, g: svg, width, height } = initSvg(svgEl, totalWidth, 250, margin);

    const y = d3
      .scaleBand()
      .domain(this.data.map((d) => d.label))
      .range([0, height])
      .padding(0.3);

    const x = d3
      .scaleLinear()
      .domain([0, 100])
      .range([0, width]);

    svg.append('g').call(
      d3.axisLeft(y).tickSize(0).tickPadding(45),
    ).call((g) => g.select('.domain').remove());

    // NPS column header
    svg
      .append('text')
      .attr('x', -10)
      .attr('y', -8)
      .attr('text-anchor', 'end')
      .attr('font-size', '10px')
      .attr('font-weight', '700')
      .attr('fill', '#94a3b8')
      .text('NPS');

    const color = d3
      .scaleOrdinal<string>()
      .domain(this.keys)
      .range(this.keys.map((k) => this.colors[k]));

    const stack = d3
      .stack<StackDatum>()
      .keys(this.keys as Array<keyof StackDatum>);

    const series = stack(this.data);

    // Grid lines (row separators + column separator) — togglable
    const grid = svg.append('g').attr('class', 'grid-lines')
      .attr('display', this.showGrid ? null : 'none');
    const lineColor = '#d1d5db';

    // Horizontal row separators
    this.data.forEach((d) => {
      const rowTop = y(d.label) ?? 0;
      grid.append('line')
        .attr('x1', -margin.left).attr('x2', width)
        .attr('y1', rowTop).attr('y2', rowTop)
        .attr('stroke', lineColor).attr('stroke-width', 1);
    });
    // Bottom border
    const lastRow = this.data[this.data.length - 1];
    const bottomY = (y(lastRow.label) ?? 0) + y.bandwidth();
    grid.append('line')
      .attr('x1', -margin.left).attr('x2', width)
      .attr('y1', bottomY).attr('y2', bottomY)
      .attr('stroke', lineColor).attr('stroke-width', 1);

    // Vertical column separators: before NPS column & before bars
    [-(margin.left - 10), -35, 0].forEach((xPos) => {
      grid.append('line')
        .attr('x1', xPos).attr('x2', xPos)
        .attr('y1', y.range()[0]).attr('y2', bottomY)
        .attr('stroke', lineColor).attr('stroke-width', 1);
    });

    // NPS Score column — displayed before each bar
    svg
      .selectAll('.nps-score')
      .data(this.data)
      .join('text')
      .attr('class', 'nps-score')
      .attr('x', -10)
      .attr('y', (d) => (y(d.label) ?? 0) + y.bandwidth() / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', 'end')
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .attr('fill', '#334155')
      .text((d) => {
        const score = d.promoters - d.detractors;
        return `${score >= 0 ? '+' : ''}${score.toFixed(1)}`;
      });

    // Render stacked layers
    const layers = svg
      .selectAll<SVGGElement, d3.SeriesPoint<StackDatum>[]>('g.layer')
      .data(series)
      .join('g')
      .attr('class', (d) => `layer layer-${d.key}`)
      .attr('fill', (d) => color(d.key));

    const rects = layers
      .selectAll<SVGRectElement, d3.SeriesPoint<StackDatum>>('rect')
      .data((d) => d)
      .join('rect')
      .attr('y', (d) => y(d.data.label) ?? 0)
      .attr('x', (d) => x(d[0]))
      .attr('width', (d) => x(d[1]) - x(d[0]))
      .attr('height', y.bandwidth());

    // Inline text labels — only shown if segment is wide enough
    layers
      .selectAll<SVGTextElement, d3.SeriesPoint<StackDatum>>('text')
      .data((d) => d)
      .join('text')
      .filter((d) => x(d[1]) - x(d[0]) > 30)
      .attr('x', (d) => x(d[0]) + (x(d[1]) - x(d[0])) / 2)
      .attr('y', (d) => (y(d.data.label) ?? 0) + y.bandwidth() / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('font-weight', '500')
      .attr('fill', '#fff')
      .text((d) => `${(d[1] - d[0]).toFixed(1)}%`);

    attachTooltip(
      rects,
      {
        onUpdate: (state) => {
          if (state.visible && !state.title) {
            this.tooltip = { ...this.tooltip, x: state.x, y: state.y };
          } else {
            this.tooltip = state;
          }
        },
      },
      (d) => ({
        title: d.data.label,
        rows: [
          { color: this.colors['promoters'], label: 'Promoters', value: d.data.promoters },
          { color: this.colors['neutrals'], label: 'Neutrals', value: d.data.neutrals },
          { color: this.colors['detractors'], label: 'Detractors', value: d.data.detractors },
        ],
      }),
    );

    attachClick(rects, (e) => this.barClick.emit({ datum: (e.datum as any).data, event: e.event }));

    // Legend
    const legendItems: LegendItem[] = this.keys.map((key) => ({
      label: key.charAt(0).toUpperCase() + key.slice(1),
      color: this.colors[key],
    }));
    drawLegend(root, legendItems, margin.left, 12, {
      layout: 'horizontal',
      onHighlight: (highlighted) => {
        this.keys.forEach((key) => {
          const label = key.charAt(0).toUpperCase() + key.slice(1);
          const isActive = highlighted === null || label === highlighted;
          svg.select(`.layer-${key}`)
            .transition().duration(300)
            .style('opacity', isActive ? 1 : 0.12);
        });
      },
    });
  }

  toggleGrid(): void {
    this.showGrid = !this.showGrid;
    d3.select(this.svgRef.nativeElement)
      .select('.grid-lines')
      .attr('display', this.showGrid ? null : 'none');
  }
}
