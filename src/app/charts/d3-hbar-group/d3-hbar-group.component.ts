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

interface GroupDatum {
  group: string;
  [key: string]: string | number;
}

interface SubgroupDatum {
  key: string;
  value: number;
  group: string;
}

interface PeriodData {
  label: string;
  data: GroupDatum[];
}

@Component({
  selector: 'app-d3-hbar-group',
  standalone: true,
  imports: [CodeBlockComponent, ChartTooltipComponent],
  templateUrl: './d3-hbar-group.component.html',
  styleUrl: './d3-hbar-group.component.scss',
})
export class D3HbarGroupComponent implements OnInit, OnDestroy {
  @ViewChild('chart', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;
  @ViewChild('chartContainer', { static: true }) private containerRef!: ElementRef<HTMLDivElement>;
  @Output() barClick = new EventEmitter<ChartClickEvent<SubgroupDatum>>();

  tooltip: TooltipState = emptyTooltip();

  private destroyResize?: () => void;

  private subgroups = ['ProductA', 'ProductB', 'ProductC'];

  private periods: PeriodData[] = [
    {
      label: '2024',
      data: [
        { group: 'Q1', ProductA: 40, ProductB: 25, ProductC: 15 },
        { group: 'Q2', ProductA: 55, ProductB: 40, ProductC: 30 },
        { group: 'Q3', ProductA: 35, ProductB: 60, ProductC: 45 },
        { group: 'Q4', ProductA: 70, ProductB: 50, ProductC: 55 },
      ],
    },
    {
      label: '2025',
      data: [
        { group: 'Q1', ProductA: 50, ProductB: 30, ProductC: 20 },
        { group: 'Q2', ProductA: 65, ProductB: 48, ProductC: 38 },
        { group: 'Q3', ProductA: 42, ProductB: 72, ProductC: 55 },
        { group: 'Q4', ProductA: 85, ProductB: 62, ProductC: 68 },
      ],
    },
  ];

  private groups = ['Q1', 'Q2', 'Q3', 'Q4'];

  dataModelCode = `interface GroupDatum {
  group: string;                      // primary category (y-axis)
  [key: string]: string | number;     // dynamic subgroup values
}

// Multi-period: wrap each period's data with a label
interface PeriodData {
  label: string;        // e.g. '2024', '2025'
  data: GroupDatum[];
}

const subgroups = ['ProductA', 'ProductB', 'ProductC'];`;

  scalesCode = `// Shared y-axis across all periods
const y0 = d3.scaleBand()
  .domain(groups)
  .range([0, height])
  .padding(0.25);

const y1 = d3.scaleBand()
  .domain(subgroups)
  .range([0, y0.bandwidth()])
  .padding(0.1);

// Shared x-scale — domain from max across ALL periods
const xMax = d3.max(periods, p =>
  d3.max(p.data, d => Math.max(...subgroups.map(k => d[k])))
);
const x = d3.scaleLinear()
  .domain([0, xMax]).nice()
  .range([0, panelWidth]);`;

  renderCode = `// Render one panel per period (small multiples)
periods.forEach((period, i) => {
  const panel = svg.append('g')
    .attr('transform', \`translate(\${i * (panelWidth + gap)}, 0)\`);

  // Period title
  panel.append('text').text(period.label)
    .attr('x', panelWidth / 2).attr('y', -8);

  // Bars + value labels
  const groups = panel.selectAll('g.group')
    .data(period.data).join('g')
    .attr('transform', d => \`translate(0,\${y0(d.group)})\`);

  groups.selectAll('rect')
    .data(d => subgroups.map(key => ({ key, value: d[key] })))
    .join('rect')
    .attr('y', d => y1(d.key))
    .attr('width', d => x(d.value))
    .attr('height', y1.bandwidth())
    .attr('fill', d => color(d.key));

  // Value labels at bar ends
  groups.selectAll('text.label')
    .data(d => subgroups.map(key => ({ key, value: d[key] })))
    .join('text')
    .attr('x', d => x(d.value) + 4)
    .attr('y', d => y1(d.key) + y1.bandwidth() / 2)
    .text(d => d.value);
});`;

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
  title: d.group,
  rows: [{ color: color(d.key), label: d.key, value: d.value }],
}));

// Template — project custom Angular content via <ng-content>
// <app-chart-tooltip [state]="tooltip">
//   <my-custom-component [data]="extraData" />
// </app-chart-tooltip>`;

  labelCode = `// Value labels — append text after each bar
groups.selectAll('text.label')
  .data(d => subgroups.map(key => ({ key, value: d[key] })))
  .join('text')
  .attr('class', 'label')
  .attr('x', d => x(d.value) + 4)       // 4px right of bar end
  .attr('y', d => y1(d.key) + y1.bandwidth() / 2)
  .attr('dominant-baseline', 'middle')
  .attr('font-size', '11px')
  .attr('fill', '#64748b')
  .text(d => d.value);`;

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
    const margin = { top: 30, right: 120, bottom: 30, left: 60 };
    const gap = 40;
    const availableWidth = Math.max(500, containerWidth) - margin.left - margin.right;
    const panelWidth = Math.max(150, (availableWidth - (this.periods.length - 1) * gap) / this.periods.length);
    const totalWidth = margin.left + this.periods.length * panelWidth + (this.periods.length - 1) * gap + margin.right;
    const totalHeight = 320;
    const height = totalHeight - margin.top - margin.bottom;

    const root = d3
      .select(svgEl)
      .attr('width', totalWidth)
      .attr('height', totalHeight);

    const svg = root
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const color = d3.scaleOrdinal<string>().domain(this.subgroups).range(d3.schemeTableau10);

    // Shared y-axis
    const y0 = d3
      .scaleBand()
      .domain(this.groups)
      .range([0, height])
      .padding(0.25);

    const y1 = d3
      .scaleBand()
      .domain(this.subgroups)
      .range([0, y0.bandwidth()])
      .padding(0.1);

    // Shared x-scale — domain from max across all periods
    const xMax = d3.max(this.periods, (p) =>
      d3.max(p.data, (d) => Math.max(...this.subgroups.map((k) => d[k] as number)))
    ) ?? 100;

    const x = d3
      .scaleLinear()
      .domain([0, xMax])
      .nice()
      .range([0, panelWidth]);

    // Draw shared y-axis once
    svg.append('g').call(d3.axisLeft(y0));

    // Render each period as a panel
    this.periods.forEach((period, i) => {
      const panelX = i * (panelWidth + gap);
      const panel = svg.append('g').attr('transform', `translate(${panelX}, 0)`);

      // Period title
      panel
        .append('text')
        .attr('x', panelWidth / 2)
        .attr('y', -10)
        .attr('text-anchor', 'middle')
        .attr('font-size', '13px')
        .attr('font-weight', '700')
        .attr('fill', '#334155')
        .text(period.label);

      // X-axis per panel
      panel
        .append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(4));

      // Groups → bars
      const groups = panel
        .append('g')
        .selectAll('g')
        .data(period.data)
        .join('g')
        .attr('transform', (d) => `translate(0,${y0(d.group) ?? 0})`);

      const bars = groups
        .selectAll('rect')
        .data((d) => this.subgroups.map((key) => ({ key, value: d[key] as number, group: d.group })))
        .join('rect')
        .attr('class', (d) => `bar-${d.key}`)
        .attr('y', (d) => y1(d.key) ?? 0)
        .attr('x', 0)
        .attr('width', (d) => x(d.value))
        .attr('height', y1.bandwidth())
        .attr('fill', (d) => color(d.key));

      // Value labels at bar ends
      groups
        .selectAll<SVGTextElement, SubgroupDatum>('text.label')
        .data((d) => this.subgroups.map((key) => ({ key, value: d[key] as number, group: d.group })))
        .join('text')
        .attr('class', (d) => `label label-${d.key}`)
        .attr('x', (d) => x(d.value) + 4)
        .attr('y', (d) => (y1(d.key) ?? 0) + y1.bandwidth() / 2)
        .attr('dominant-baseline', 'middle')
        .attr('font-size', '11px')
        .attr('fill', '#64748b')
        .text((d) => d.value);

      // Tooltip + click
      const typedBars = bars as unknown as d3.Selection<SVGRectElement, SubgroupDatum, SVGGElement, unknown>;

      attachTooltip(typedBars, {
        onUpdate: (state) => {
          if (state.visible && !state.title) {
            this.tooltip = { ...this.tooltip, x: state.x, y: state.y };
          } else {
            this.tooltip = state;
          }
        },
      }, (d) => ({
        title: `${d.group} — ${period.label}`,
        rows: [{ color: color(d.key), label: d.key, value: d.value }],
      }));

      attachClick(typedBars, (e) => this.barClick.emit(e));
    });

    // Shared legend
    const legendX = this.periods.length * (panelWidth + gap) - gap + 10;
    const legendItems: LegendItem[] = this.subgroups.map((key) => ({ label: key, color: color(key) }));
    const svgSel = d3.select(svgEl);
    drawLegend(svg, legendItems, legendX, 0, {
      onHighlight: (highlighted) => {
        this.subgroups.forEach((key) => {
          const isActive = highlighted === null || key === highlighted;
          svgSel.selectAll(`.bar-${key}`)
            .transition().duration(300)
            .style('opacity', isActive ? 1 : 0.12);
          svgSel.selectAll(`.label-${key}`)
            .transition().duration(300)
            .style('opacity', isActive ? 1 : 0.12);
        });
      },
    });
  }
}
