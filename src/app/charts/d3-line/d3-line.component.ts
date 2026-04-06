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
import { initSvg, drawLegend, LegendItem, observeResize } from '../../core/utils/d3.helpers';
import { ChartClickEvent } from '../../core/models';
import { MockApiService } from '../../core/services/mock-api.service';
import { LINE_SNIPPETS } from './d3-line.snippets';

export interface LineDatum {
  month: string;
  value: number;
}

export interface LineSeries {
  name: string;
  values: LineDatum[];
}

@Component({
  selector: 'app-d3-line',
  standalone: true,
  imports: [CodeBlockComponent, ChartTooltipComponent, ChartActionMenuComponent, DataTableModalComponent],
  templateUrl: './d3-line.component.html',
  styleUrl: './d3-line.component.scss',
})
export class D3LineComponent implements OnInit, OnDestroy, OnChanges {
  @ViewChild('chart', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;
  @ViewChild('chartContainer', { static: true }) private containerRef!: ElementRef<HTMLDivElement>;
  @Input() series: LineSeries[] = [];
  @Output() dotClick = new EventEmitter<ChartClickEvent<LineDatum>>();

  tooltip: TooltipState = emptyTooltip();
  actionMenu: ActionMenuState = emptyActionMenu();
  dataTable: DataTableConfig = emptyDataTable();

  curveOptions: { key: string; label: string; curve: d3.CurveFactory }[] = [
    { key: 'monotoneX', label: 'Smooth', curve: d3.curveMonotoneX },
    { key: 'linear', label: 'Straight', curve: d3.curveLinear },
    { key: 'step', label: 'Step', curve: d3.curveStep },
    { key: 'basis', label: 'Basis', curve: d3.curveBasis },
    { key: 'cardinal', label: 'Cardinal', curve: d3.curveCardinal },
  ];
  activeCurve = 'monotoneX';

  loading = true;

  // Selection & filter state
  selectedSeries = new Set<string>();
  excludedSeries = new Set<string>();
  activeFilterLabel = '';

  private destroyResize?: () => void;
  private readonly api = inject(MockApiService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly snippets = LINE_SNIPPETS;

  ngOnInit(): void {
    if (this.series.length) {
      this.loading = false;
      this.draw();
    } else {
      this.api.getLineData().subscribe((records) => {
        this.series = records.map((r) => ({ name: r.name, values: r.values }));
        this.loading = false;
        this.draw();
      });
    }
    this.destroyResize = observeResize(this.containerRef.nativeElement, () => this.draw());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['series'] && !changes['series'].firstChange) {
      this.draw();
    }
  }

  ngOnDestroy(): void {
    this.destroyResize?.();
  }

  setCurve(key: string): void {
    this.activeCurve = key;
    this.draw();
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
    this.selectedSeries.clear();
    this.updateSelectionVisuals();
  }

  onAction(action: ChartAction): void {
    switch (action) {
      case 'keepOnly':
        this.excludedSeries.clear();
        const allNames = this.series.map(s => s.name);
        allNames.forEach(n => {
          if (!this.selectedSeries.has(n)) this.excludedSeries.add(n);
        });
        this.activeFilterLabel = `Showing: ${[...this.selectedSeries].join(', ')}`;
        break;

      case 'exclude':
        this.selectedSeries.forEach(n => this.excludedSeries.add(n));
        this.activeFilterLabel = `Excluded: ${[...this.selectedSeries].join(', ')}`;
        break;

      case 'sort':
        break; // Sort doesn't apply to line charts

      case 'viewTable':
        this.openDataTable();
        break;
    }

    this.actionMenu = emptyActionMenu();
    this.selectedSeries.clear();
    this.draw();
  }

  clearFilters(): void {
    this.excludedSeries.clear();
    this.activeFilterLabel = '';
    this.draw();
  }

  closeDataTable(): void {
    this.dataTable = emptyDataTable();
  }

  private openDataTable(): void {
    const filtered = this.series.filter(s => !this.excludedSeries.has(s.name));
    const selected = this.selectedSeries.size > 0
      ? filtered.filter(s => this.selectedSeries.has(s.name))
      : filtered;

    const months = selected[0]?.values.map(v => v.month) ?? [];
    const columns = ['Month', ...selected.map(s => s.name)];
    const rows = months.map(month => {
      const row: Record<string, string | number> = { Month: month };
      selected.forEach(s => {
        row[s.name] = s.values.find(v => v.month === month)?.value ?? 0;
      });
      return row;
    });

    this.dataTable = { visible: true, title: 'Line Chart Data', columns, rows };
  }

  // ── Selection visuals ──────────────────────────────────────────────

  private updateSelectionVisuals(): void {
    const svgSel = d3.select(this.svgRef.nativeElement);
    const selected = this.selectedSeries;
    if (selected.size === 0) {
      svgSel.selectAll('[data-series]').attr('opacity', 1);
    } else {
      svgSel.selectAll<SVGElement, unknown>('[data-series]').each(function () {
        const s = this.dataset['series'] ?? '';
        d3.select(this).attr('opacity', selected.has(s) ? 1 : 0.15);
      });
    }
  }

  // ── Draw ───────────────────────────────────────────────────────────

  private draw(): void {
    if (!this.series.length) return;
    const svgEl = this.svgRef.nativeElement;
    d3.select(svgEl).selectAll('*').remove();

    // Apply filters
    const filtered = this.series.filter(s => !this.excludedSeries.has(s.name));
    if (!filtered.length) return;

    const containerWidth = this.containerRef.nativeElement.clientWidth - 48;
    const totalWidth = Math.max(400, containerWidth);
    const margin = { top: 40, right: 20, bottom: 40, left: 50 };
    const { g: svg, width, height } = initSvg(svgEl, totalWidth, 350, margin);

    const months = filtered[0].values.map(v => v.month);
    const color = d3.scaleOrdinal<string>().domain(filtered.map((s) => s.name)).range(d3.schemeTableau10);

    const x = d3.scalePoint().domain(months).range([0, width]);

    const allValues = filtered.flatMap((s) => s.values.map((v) => v.value));
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

    filtered.forEach((s) => {
      svg
        .append('path')
        .datum(s.values)
        .attr('class', `series-path series-${s.name}`)
        .attr('data-series', s.name)
        .attr('fill', 'none')
        .attr('stroke', color(s.name))
        .attr('stroke-width', 2.5)
        .attr('d', line);

      const dots = svg
        .selectAll<SVGCircleElement, LineDatum>(`.dot-${s.name}`)
        .data(s.values)
        .join('circle')
        .attr('class', `series-dot series-${s.name}`)
        .attr('data-series', s.name)
        .attr('cx', (d) => x(d.month) ?? 0)
        .attr('cy', (d) => y(d.value))
        .attr('r', 4)
        .attr('fill', color(s.name))
        .style('cursor', 'pointer')
        .on('mouseover', (event: MouseEvent, d: LineDatum) => {
          const cRect = this.containerRef.nativeElement.getBoundingClientRect();
          const cx = event.clientX - cRect.left + this.containerRef.nativeElement.scrollLeft;
          const cy = event.clientY - cRect.top + this.containerRef.nativeElement.scrollTop;
          this.tooltip = {
            visible: true,
            x: cx,
            y: cy,
            title: d.month,
            rows: filtered.map((sr) => ({
              color: color(sr.name),
              label: sr.name,
              value: sr.values.find((v) => v.month === d.month)?.value ?? 0,
            })),
          };
          d3.select(event.currentTarget as SVGCircleElement)
            .attr('r', 7)
            .attr('stroke', '#fff')
            .attr('stroke-width', 2);
          this.cdr.detectChanges();
        })
        .on('mousemove', (event: MouseEvent) => {
          const cRect = this.containerRef.nativeElement.getBoundingClientRect();
          const cx = event.clientX - cRect.left + this.containerRef.nativeElement.scrollLeft;
          const cy = event.clientY - cRect.top + this.containerRef.nativeElement.scrollTop;
          this.tooltip = { ...this.tooltip, x: cx, y: cy };
          this.cdr.detectChanges();
        })
        .on('mouseleave', (event: MouseEvent) => {
          this.tooltip = emptyTooltip();
          this.cdr.detectChanges();
          d3.select(event.currentTarget as SVGCircleElement)
            .attr('r', 4)
            .attr('stroke', 'none');
        });

      // Click → select series + show action menu
      dots.on('click', (event: MouseEvent, d: LineDatum) => {
        event.stopPropagation();
        this.dotClick.emit({ datum: d, event });

        if (event.shiftKey) {
          if (this.selectedSeries.has(s.name)) {
            this.selectedSeries.delete(s.name);
          } else {
            this.selectedSeries.add(s.name);
          }
        } else {
          this.selectedSeries.clear();
          this.selectedSeries.add(s.name);
        }

        this.updateSelectionVisuals();

        const cRect = this.containerRef.nativeElement.getBoundingClientRect();
        this.actionMenu = {
          visible: true,
          x: event.clientX - cRect.left + this.containerRef.nativeElement.scrollLeft + 10,
          y: event.clientY - cRect.top + this.containerRef.nativeElement.scrollTop - 10,
          selectedLabels: [...this.selectedSeries],
          summaryText: `${this.selectedSeries.size} series selected`,
        };
      });
    });

    const root = d3.select(svgEl);
    const legendItems: LegendItem[] = filtered.map(s => ({ label: s.name, color: color(s.name) }));
    drawLegend(root, legendItems, margin.left, 12, {
      style: 'line',
      layout: 'horizontal',
      onHighlight: (highlighted) => {
        filtered.forEach((s) => {
          const isActive = highlighted === null || s.name === highlighted;
          svg.selectAll(`.series-${s.name}`)
            .transition().duration(300)
            .style('opacity', isActive ? 1 : 0.12);
        });
      },
    });
  }
}
