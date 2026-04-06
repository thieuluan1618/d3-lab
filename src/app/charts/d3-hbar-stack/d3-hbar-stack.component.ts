import { ChangeDetectorRef, Component, ElementRef, EventEmitter, HostListener, inject, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges, ViewChild } from '@angular/core';
import { CodeBlockComponent } from '../../shared/components/code-block/code-block.component';
import {
  ChartTooltipComponent,
  TooltipState,
  emptyTooltip,
} from '../../shared/components/chart-tooltip/chart-tooltip.component';
import {
  ChartActionMenuComponent,
  ActionMenuState,
  ChartAction,
  emptyActionMenu,
} from '../../shared/components/chart-action-menu/chart-action-menu.component';
import {
  DataTableModalComponent,
  DataTableConfig,
  emptyDataTable,
} from '../../shared/components/data-table-modal/data-table-modal.component';
import * as d3 from 'd3';
import { initSvg, attachTooltip, drawLegend, LegendItem, observeResize } from '../../core/utils/d3.helpers';
import { ChartClickEvent } from '../../core/models';
import { MockApiService } from '../../core/services/mock-api.service';
import { HBAR_STACK_SNIPPETS } from './d3-hbar-stack.snippets';

export interface StackDatum {
  label: string;
  [key: string]: string | number;
}

export interface HbarStackInput {
  data: StackDatum[];
  keys: string[];
  colors: Record<string, string>;
}

@Component({
  selector: 'app-d3-hbar-stack',
  standalone: true,
  imports: [CodeBlockComponent, ChartTooltipComponent, ChartActionMenuComponent, DataTableModalComponent],
  templateUrl: './d3-hbar-stack.component.html',
  styleUrl: './d3-hbar-stack.component.scss',
})
export class D3HbarStackComponent implements OnInit, OnDestroy, OnChanges {
  @ViewChild('chart', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;
  @ViewChild('chartContainer', { static: true }) private containerRef!: ElementRef<HTMLDivElement>;
  @Input() chartData: HbarStackInput = { data: [], keys: [], colors: {} };
  @Output() barClick = new EventEmitter<ChartClickEvent<StackDatum>>();

  tooltip: TooltipState = emptyTooltip();
  actionMenu: ActionMenuState = emptyActionMenu();
  dataTable: DataTableConfig = emptyDataTable();
  showGrid = false;
  loading = true;

  // Selection & filter state
  selectedLabels = new Set<string>();
  excludedLabels = new Set<string>();
  private sortAsc = false;
  activeFilterLabel = '';

  private destroyResize?: () => void;
  private readonly api = inject(MockApiService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly snippets = HBAR_STACK_SNIPPETS;

  ngOnInit(): void {
    if (this.chartData.data.length) {
      this.loading = false;
      this.draw();
    } else {
      this.api.getHbarStackData().subscribe((records) => {
        this.chartData = {
          data: records.map((r) => ({
            label: r.company,
            promoters: r.promoters,
            neutrals: r.neutrals,
            detractors: r.detractors,
          })),
          keys: ['promoters', 'neutrals', 'detractors'],
          colors: { promoters: '#22c55e', neutrals: '#eab308', detractors: '#f97316' },
        };
        this.loading = false;
        this.draw();
      });
    }
    this.destroyResize = observeResize(this.containerRef.nativeElement, () => this.draw());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['chartData'] && !changes['chartData'].firstChange) {
      this.draw();
    }
  }

  ngOnDestroy(): void {
    this.destroyResize?.();
  }

  // ── Click outside to dismiss ───────────────────────────────────────

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.actionMenu.visible) {
      this.dismissMenu();
    }
  }

  // ── Action menu handlers ───────────────────────────────────────────

  dismissMenu(): void {
    this.actionMenu = emptyActionMenu();
    this.selectedLabels.clear();
    this.updateSelectionVisuals();
  }

  onAction(action: ChartAction): void {
    switch (action) {
      case 'keepOnly':
        this.excludedLabels.clear();
        const allLabels = this.chartData.data.map(d => d.label);
        allLabels.forEach(l => {
          if (!this.selectedLabels.has(l)) this.excludedLabels.add(l);
        });
        this.activeFilterLabel = `Showing: ${[...this.selectedLabels].join(', ')}`;
        break;

      case 'exclude':
        this.selectedLabels.forEach(l => this.excludedLabels.add(l));
        this.activeFilterLabel = `Excluded: ${[...this.selectedLabels].join(', ')}`;
        break;

      case 'sort':
        this.sortAsc = !this.sortAsc;
        break;

      case 'viewTable':
        this.openDataTable();
        break;
    }

    this.actionMenu = emptyActionMenu();
    this.selectedLabels.clear();
    this.draw();
  }

  clearFilters(): void {
    this.excludedLabels.clear();
    this.activeFilterLabel = '';
    this.sortAsc = false;
    this.draw();
  }

  closeDataTable(): void {
    this.dataTable = emptyDataTable();
  }

  private openDataTable(): void {
    const { data, keys } = this.chartData;
    const selected = this.selectedLabels.size > 0
      ? data.filter(d => this.selectedLabels.has(d.label))
      : data;

    const columns = ['Label', ...keys.map(k => k.charAt(0).toUpperCase() + k.slice(1))];
    const rows = selected.map(d => {
      const row: Record<string, string | number> = { Label: d.label };
      keys.forEach(k => {
        row[k.charAt(0).toUpperCase() + k.slice(1)] = d[k] as number;
      });
      return row;
    });

    this.dataTable = { visible: true, title: 'Stacked Bar Data', columns, rows };
  }

  // ── Selection visuals ──────────────────────────────────────────────

  private updateSelectionVisuals(): void {
    const svgSel = d3.select(this.svgRef.nativeElement);
    const selected = this.selectedLabels;
    if (selected.size === 0) {
      svgSel.selectAll('rect[data-label]').attr('opacity', 1);
    } else {
      svgSel.selectAll<SVGRectElement, unknown>('rect[data-label]').each(function () {
        const l = this.dataset['label'] ?? '';
        d3.select(this).attr('opacity', selected.has(l) ? 1 : 0.2);
      });
    }
  }

  // ── Draw ───────────────────────────────────────────────────────────

  private draw(): void {
    const { data, keys, colors: colorMap } = this.chartData;
    if (!data.length) return;
    const svgEl = this.svgRef.nativeElement;
    d3.select(svgEl).selectAll('*').remove();

    // Apply filters
    let filtered = data.filter(d => !this.excludedLabels.has(d.label));

    // Apply sort (by NPS score = first key - last key)
    if (this.sortAsc) {
      const first = keys[0];
      const last = keys[keys.length - 1];
      filtered = [...filtered].sort((a, b) =>
        ((a[first] as number) - (a[last] as number)) - ((b[first] as number) - (b[last] as number))
      );
    }

    const containerWidth = this.containerRef.nativeElement.clientWidth - 48;
    const totalWidth = Math.max(400, containerWidth);
    const margin = { top: 40, right: 30, bottom: 10, left: 150 };
    const chartHeight = Math.max(250, filtered.length * 55);
    const { root, g: svg, width, height } = initSvg(svgEl, totalWidth, chartHeight, margin);

    const y = d3
      .scaleBand()
      .domain(filtered.map((d) => d.label))
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
      .domain(keys)
      .range(keys.map((k) => colorMap[k]));

    const stack = d3
      .stack<StackDatum>()
      .keys(keys as any);

    const series = stack(filtered);

    // Grid lines (row separators + column separator) — togglable
    const grid = svg.append('g').attr('class', 'grid-lines')
      .attr('display', this.showGrid ? null : 'none');
    const lineColor = '#d1d5db';

    // Horizontal row separators
    filtered.forEach((d) => {
      const rowTop = y(d.label) ?? 0;
      grid.append('line')
        .attr('x1', -margin.left).attr('x2', width)
        .attr('y1', rowTop).attr('y2', rowTop)
        .attr('stroke', lineColor).attr('stroke-width', 1);
    });
    // Bottom border
    const lastRow = filtered[filtered.length - 1];
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
      .selectAll<SVGTextElement, StackDatum>('.nps-score')
      .data(filtered)
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
        const first = keys[0];
        const last = keys[keys.length - 1];
        const score = (d[first] as number) - (d[last] as number);
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
      .attr('data-label', (d) => d.data.label)
      .attr('y', (d) => y(d.data.label) ?? 0)
      .attr('x', (d) => x(d[0]))
      .attr('width', (d) => x(d[1]) - x(d[0]))
      .attr('height', y.bandwidth())
      .style('cursor', 'pointer');

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
          this.cdr.detectChanges();
        },
      },
      (d) => ({
        title: d.data.label as string,
        rows: keys.map((key) => ({
          color: colorMap[key],
          label: key.charAt(0).toUpperCase() + key.slice(1),
          value: `${(d.data[key] as number).toFixed(1)}%`,
        })),
      }),
      this.containerRef.nativeElement,
    );

    // Click → select + show action menu
    rects.on('click', (event: MouseEvent, d: d3.SeriesPoint<StackDatum>) => {
      event.stopPropagation();
      this.barClick.emit({ datum: d.data, event });
      const label = d.data.label;

      if (event.shiftKey) {
        if (this.selectedLabels.has(label)) {
          this.selectedLabels.delete(label);
        } else {
          this.selectedLabels.add(label);
        }
      } else {
        this.selectedLabels.clear();
        this.selectedLabels.add(label);
      }

      this.updateSelectionVisuals();

      const cRect = this.containerRef.nativeElement.getBoundingClientRect();
      this.actionMenu = {
        visible: true,
        x: event.clientX - cRect.left + this.containerRef.nativeElement.scrollLeft + 10,
        y: event.clientY - cRect.top + this.containerRef.nativeElement.scrollTop - 10,
        selectedLabels: [...this.selectedLabels],
        summaryText: `${this.selectedLabels.size} company${this.selectedLabels.size > 1 ? 'ies' : ''} selected`,
      };
    });

    // Legend — horizontal at top
    const legendItems: LegendItem[] = keys.map((key) => ({
      label: key.charAt(0).toUpperCase() + key.slice(1),
      color: colorMap[key],
    }));
    drawLegend(root, legendItems, margin.left, 12, {
      layout: 'horizontal',
      onHighlight: (highlighted) => {
        keys.forEach((key) => {
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
