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

interface BarDatum {
  label: string;
  value: number;
}

@Component({
  selector: 'app-d3-bar',
  standalone: true,
  imports: [CodeBlockComponent, ChartTooltipComponent],
  templateUrl: './d3-bar.component.html',
  styleUrl: './d3-bar.component.scss',
})
export class D3BarComponent implements OnInit, OnDestroy {
  @ViewChild('chart', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;
  @ViewChild('chartContainer', { static: true }) private containerRef!: ElementRef<HTMLDivElement>;
  @Output() barClick = new EventEmitter<ChartClickEvent<BarDatum>>();

  tooltip: TooltipState = emptyTooltip();

  private destroyResize?: () => void;

  private data: BarDatum[] = [
    { label: 'Jan', value: 30 },
    { label: 'Feb', value: 80 },
    { label: 'Mar', value: 45 },
    { label: 'Apr', value: 60 },
    { label: 'May', value: 20 },
    { label: 'Jun', value: 90 },
  ];

  dataModelCode = `interface BarDatum {
  label: string;   // → scaleBand domain (x-axis)
  value: number;   // → scaleLinear domain (y-axis)
}`;

  scalesCode = `// X-axis: categorical → evenly spaced bands
const x = d3.scaleBand()
  .domain(data.map(d => d.label))
  .range([0, width])
  .padding(0.3);

// Y-axis: numeric → pixel range (inverted)
const y = d3.scaleLinear()
  .domain([0, d3.max(data, d => d.value)])
  .nice()
  .range([height, 0]);`;

  renderCode = `// Bind data to <rect> elements using join pattern
svg.selectAll('.bar')
  .data(data)
  .join('rect')
  .attr('x', d => x(d.label))
  .attr('y', d => y(d.value))
  .attr('width', x.bandwidth())
  .attr('height', d => height - y(d.value))
  .attr('fill', 'steelblue');`;

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
  rows: [{ label: 'Value', value: d.value }],
}));

// Template — project custom Angular content via <ng-content>
// <app-chart-tooltip [state]="tooltip">
//   <my-custom-component [data]="extraData" />
// </app-chart-tooltip>`;

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

    const containerWidth = this.containerRef.nativeElement.clientWidth - 48; // p-6 padding
    const totalWidth = Math.max(400, containerWidth);
    const margin = { top: 20, right: 20, bottom: 40, left: 50 };
    const { g: svg, width, height } = initSvg(svgEl, totalWidth, 350, margin);

    const x = d3
      .scaleBand()
      .domain(this.data.map((d) => d.label))
      .range([0, width])
      .padding(0.3);

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(this.data, (d) => d.value) ?? 100])
      .nice()
      .range([height, 0]);

    svg
      .append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x));

    svg.append('g').call(d3.axisLeft(y));

    const bars = svg
      .selectAll<SVGRectElement, BarDatum>('.bar')
      .data(this.data)
      .join('rect')
      .attr('class', 'bar')
      .attr('x', (d) => x(d.label) ?? 0)
      .attr('y', (d) => y(d.value))
      .attr('width', x.bandwidth())
      .attr('height', (d) => height - y(d.value))
      .attr('fill', 'steelblue');

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
        rows: [{ label: 'Value', value: d.value }],
      }),
    );

    attachClick(bars, (e) => this.barClick.emit(e));
  }
}
