import { Component, ElementRef, EventEmitter, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { CodeBlockComponent } from '../../shared/components/code-block/code-block.component';
import {
  ChartTooltipComponent,
  TooltipState,
  emptyTooltip,
} from '../../shared/components/chart-tooltip/chart-tooltip.component';
import * as d3 from 'd3';
import { initSvg, attachTooltip, attachClick, observeResize } from '../../core/utils/d3.helpers';
import { ChartClickEvent } from '../../core/models';

interface BulletDatum {
  label: string;
  value: number;
}

@Component({
  selector: 'app-d3-bullet',
  standalone: true,
  imports: [CodeBlockComponent, ChartTooltipComponent],
  templateUrl: './d3-bullet.component.html',
  styleUrl: './d3-bullet.component.scss',
})
export class D3BulletComponent implements OnInit, OnDestroy {
  @ViewChild('chart', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;
  @ViewChild('chartContainer', { static: true }) private containerRef!: ElementRef<HTMLDivElement>;
  @Output() barClick = new EventEmitter<ChartClickEvent<BulletDatum>>();

  tooltip: TooltipState = emptyTooltip();
  showGrid = true;

  private destroyResize?: () => void;

  private data: BulletDatum[] = [
    { label: 'Primary Care', value: 207.4 },
    { label: 'All Health Needs', value: 206.1 },
    { label: 'Heart Care', value: 175.3 },
    { label: 'Cancer Care', value: 160.8 },
    { label: 'Orthopedic Care', value: 148.2 },
    { label: 'Emergency Care', value: 132.5 },
    { label: 'Mental Health', value: 115.7 },
    { label: 'Urgent Care', value: 98.4 },
  ];

  dataModelCode = `interface BulletDatum {
  label: string;   // → scaleBand domain (y-axis)
  value: number;   // → scaleLinear domain (x-axis)
}`;

  trackCode = `// Background track rects — full width, light gray
svg.selectAll('.track')
  .data(data)
  .join('rect')
  .attr('class', 'track')
  .attr('x', 0)
  .attr('y', d => y(d.label))
  .attr('width', width)
  .attr('height', y.bandwidth())
  .attr('fill', '#e2e8f0')
  .attr('rx', 3);`;

  renderCode = `// Value bars on top of tracks
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
  .text(d => d.value.toFixed(1));`;

  tooltipCode = `// Reusable helper wires mouseover / mousemove / mouseleave
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
}));`;

  referenceLineCode = `// Dashed vertical reference line at index = 100
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
  .text('Index 100');`;

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
    const margin = { top: 20, right: 60, bottom: 30, left: 130 };
    const { g: svg, width, height } = initSvg(svgEl, totalWidth, 350, margin);

    const sorted = [...this.data].sort((a, b) => b.value - a.value);

    const y = d3
      .scaleBand()
      .domain(sorted.map((d) => d.label))
      .range([0, height])
      .padding(0.25);

    const x = d3
      .scaleLinear()
      .domain([0, Math.ceil((d3.max(sorted, (d) => d.value) ?? 210) / 10) * 10])
      .range([0, width]);

    // Grid group — axes, tracks, reference line (togglable)
    const gridGroup = svg.append('g').attr('class', 'grid-lines');

    gridGroup
      .append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(5));

    gridGroup.append('g').call(d3.axisLeft(y));

    // Background track rects
    gridGroup
      .selectAll<SVGRectElement, BulletDatum>('.track')
      .data(sorted)
      .join('rect')
      .attr('class', 'track')
      .attr('x', 0)
      .attr('y', (d) => y(d.label) ?? 0)
      .attr('width', width)
      .attr('height', y.bandwidth())
      .attr('fill', '#e2e8f0')
      .attr('rx', 3);

    // Minimal labels (visible when grid is off)
    const minimalLabels = svg.append('g').attr('class', 'minimal-labels')
      .attr('display', 'none');

    minimalLabels.append('g').call(
      d3.axisLeft(y).tickSize(0).tickPadding(8),
    ).call((g) => g.select('.domain').remove());

    // Value bars
    const bars = svg
      .selectAll<SVGRectElement, BulletDatum>('.bar')
      .data(sorted)
      .join('rect')
      .attr('class', 'bar')
      .attr('x', 0)
      .attr('y', (d) => y(d.label) ?? 0)
      .attr('width', (d) => x(d.value))
      .attr('height', y.bandwidth())
      .attr('fill', '#3b82f6')
      .attr('rx', 3);

    // Value labels
    svg
      .selectAll<SVGTextElement, BulletDatum>('.value-label')
      .data(sorted)
      .join('text')
      .attr('class', 'value-label')
      .attr('x', (d) => x(d.value) + 4)
      .attr('y', (d) => (y(d.label) ?? 0) + y.bandwidth() / 2)
      .attr('dy', '0.35em')
      .attr('font-size', '12px')
      .attr('fill', '#334155')
      .text((d) => d.value.toFixed(1));

    // Dashed reference line at index = 100
    gridGroup
      .append('line')
      .attr('x1', x(100))
      .attr('x2', x(100))
      .attr('y1', 0)
      .attr('y2', height)
      .attr('stroke', '#94a3b8')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4 3');

    gridGroup
      .append('text')
      .attr('x', x(100))
      .attr('y', -6)
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('fill', '#64748b')
      .text('Index 100');

    // Apply current grid visibility
    if (!this.showGrid) {
      d3.select(svgEl).select('.grid-lines').attr('display', 'none');
      d3.select(svgEl).select('.minimal-labels').attr('display', null);
    }

    attachTooltip(
      bars,
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
        title: d.label,
        rows: [{ label: 'Index Score', value: d.value }],
      }),
    );

    attachClick(bars, (e) => this.barClick.emit(e));
  }

  toggleGrid(): void {
    this.showGrid = !this.showGrid;
    const svgEl = d3.select(this.svgRef.nativeElement);
    svgEl.select('.grid-lines').attr('display', this.showGrid ? null : 'none');
    svgEl.select('.minimal-labels').attr('display', this.showGrid ? 'none' : null);
  }
}
