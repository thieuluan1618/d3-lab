import { Component, ElementRef, EventEmitter, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { CodeBlockComponent } from '../../shared/components/code-block/code-block.component';
import {
  ChartTooltipComponent,
  TooltipState,
  emptyTooltip,
} from '../../shared/components/chart-tooltip/chart-tooltip.component';
import * as d3 from 'd3';
import { attachTooltip, attachClick, drawLegend, LegendItem, observeResize } from '../../core/utils/d3.helpers';
import { ChartClickEvent } from '../../core/models';

interface PieDatum {
  label: string;
  value: number;
}

@Component({
  selector: 'app-d3-pie',
  standalone: true,
  imports: [CodeBlockComponent, ChartTooltipComponent],
  templateUrl: './d3-pie.component.html',
  styleUrl: './d3-pie.component.scss',
})
export class D3PieComponent implements OnInit, OnDestroy {
  @ViewChild('chart', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;
  @ViewChild('chartContainer', { static: true }) private containerRef!: ElementRef<HTMLDivElement>;
  @Output() sliceClick = new EventEmitter<ChartClickEvent<PieDatum>>();

  tooltip: TooltipState = emptyTooltip();

  private destroyResize?: () => void;

  private data: PieDatum[] = [
    { label: 'Chrome', value: 62 },
    { label: 'Safari', value: 19 },
    { label: 'Firefox', value: 5 },
    { label: 'Edge', value: 4 },
    { label: 'Other', value: 10 },
  ];

  dataModelCode = `interface PieDatum {
  label: string;   // slice name → scaleOrdinal domain
  value: number;   // slice size → d3.pie() value accessor
}`;

  layoutCode = `// d3.pie() computes start/end angles from values
const pie = d3.pie<PieDatum>()
  .value(d => d.value);

// d3.arc() converts angles to SVG <path> 'd' attribute
const arc = d3.arc<d3.PieArcDatum<PieDatum>>()
  .innerRadius(0)        // 0 = pie, > 0 = donut
  .outerRadius(radius);

// Label arc — positions text at 62% of radius
const labelArc = d3.arc<d3.PieArcDatum<PieDatum>>()
  .innerRadius(radius * 0.62)
  .outerRadius(radius * 0.62);`;

  renderCode = `// Create one <g> per slice, each containing path + text
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
  .text(d => \`\${d.data.value}%\`);`;

  tooltipCode = `// Reusable helper wires mouseover / mousemove / mouseleave
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

    const containerWidth = this.containerRef.nativeElement.clientWidth - 48;
    const maxRadius = 130;
    const legendWidth = 110;
    const gap = 24;
    const radius = Math.min(maxRadius, (containerWidth - gap - legendWidth) / 2);
    const height = radius * 2 + 40;
    const width = radius * 2 + gap + legendWidth;
    const cx = radius + 10;
    const cy = height / 2;

    const color = d3.scaleOrdinal(d3.schemeTableau10);

    const root = d3
      .select(svgEl)
      .attr('width', width)
      .attr('height', height);

    const svg = root
      .append('g')
      .attr('transform', `translate(${cx},${cy})`);

    const pie = d3.pie<PieDatum>().value((d) => d.value);
    const arc = d3.arc<d3.PieArcDatum<PieDatum>>().innerRadius(0).outerRadius(radius);
    const labelArc = d3.arc<d3.PieArcDatum<PieDatum>>()
      .innerRadius(radius * 0.62)
      .outerRadius(radius * 0.62);

    const arcs = svg.selectAll('arc').data(pie(this.data)).join('g')
      .attr('class', (d) => `slice slice-${d.data.label.replace(/\s+/g, '-')}`);

    arcs
      .append('path')
      .attr('d', arc)
      .attr('fill', (d) => color(d.data.label))
      .attr('stroke', 'white')
      .style('stroke-width', '2px');

    attachTooltip(
      arcs.select<SVGPathElement>('path'),
      {
        onUpdate: (state) => {
          if (state.visible && !state.title) {
            this.tooltip = { ...this.tooltip, x: state.x, y: state.y };
          } else {
            this.tooltip = state;
          }
        },
      },
      (d: d3.PieArcDatum<PieDatum>) => ({
        title: d.data.label,
        rows: [{ color: color(d.data.label), label: 'Share', value: d.data.value + '%' }],
      }),
    );

    attachClick(
      arcs.select<SVGPathElement>('path'),
      (e) => this.sliceClick.emit({ datum: e.datum.data, event: e.event }),
    );

    arcs
      .append('text')
      .attr('transform', (d) => `translate(${labelArc.centroid(d)})`)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '12px')
      .attr('fill', 'white')
      .style('pointer-events', 'none')
      .text((d) => `${d.data.value}%`);

    const legendX = cx + radius + gap;
    const legendY = cy - (this.data.length * 22) / 2;

    const legendItems: LegendItem[] = this.data.map((d) => ({ label: d.label, color: color(d.label) }));
    drawLegend(root, legendItems, legendX, legendY, {
      onHighlight: (highlighted) => {
        this.data.forEach((d) => {
          const safe = d.label.replace(/\s+/g, '-');
          const isActive = highlighted === null || d.label === highlighted;
          svg.select(`.slice-${safe}`)
            .transition().duration(300)
            .style('opacity', isActive ? 1 : 0.15);
        });
      },
    });
  }
}
