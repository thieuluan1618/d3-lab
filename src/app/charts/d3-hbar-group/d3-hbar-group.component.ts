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
import { attachTooltip, drawLegend, LegendItem, observeResize } from '../../core/utils/d3.helpers';
import { ChartClickEvent } from '../../core/models';
import { MockApiService } from '../../core/services/mock-api.service';
import { HBAR_GROUP_SNIPPETS } from './d3-hbar-group.snippets';

export interface GroupDatum {
  group: string;
  [key: string]: string | number;
}

export interface SubgroupDatum {
  key: string;
  value: number;
  group: string;
}

export interface HbarGroupPeriod {
  label: string;
  data: GroupDatum[];
}

export interface HbarGroupInput {
  periods: HbarGroupPeriod[];
  subgroups: string[];
}

@Component({
  selector: 'app-d3-hbar-group',
  standalone: true,
  imports: [CodeBlockComponent, ChartTooltipComponent, ChartActionMenuComponent, DataTableModalComponent],
  templateUrl: './d3-hbar-group.component.html',
  styleUrl: './d3-hbar-group.component.scss',
})
export class D3HbarGroupComponent implements OnInit, OnDestroy, OnChanges {
  @ViewChild('chart', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;
  @ViewChild('chartContainer', { static: true }) private containerRef!: ElementRef<HTMLDivElement>;
  @Input() chartData: HbarGroupInput = { periods: [], subgroups: [] };
  @Output() barClick = new EventEmitter<ChartClickEvent<SubgroupDatum>>();

  tooltip: TooltipState = emptyTooltip();
  actionMenu: ActionMenuState = emptyActionMenu();
  dataTable: DataTableConfig = emptyDataTable();
  loading = true;

  // Selection & filter state
  selectedGroups = new Set<string>();
  excludedGroups = new Set<string>();
  private sortAsc = false;
  activeFilterLabel = '';

  private destroyResize?: () => void;
  private readonly api = inject(MockApiService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly snippets = HBAR_GROUP_SNIPPETS;

  ngOnInit(): void {
    if (this.chartData.periods.length) {
      this.loading = false;
      this.draw();
    } else {
      this.api.getHbarGroupData().subscribe((responses) => {
        this.chartData = {
          subgroups: responses[0].companies,
          periods: responses.map((r) => ({
            label: r.period,
            data: r.records.map((rec) => ({ group: rec.metric, ...rec })),
          })),
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
    this.selectedGroups.clear();
    this.updateSelectionVisuals();
  }

  onAction(action: ChartAction): void {
    switch (action) {
      case 'keepOnly':
        this.excludedGroups.clear();
        const allGroups = this.chartData.periods[0]?.data.map(d => d.group) ?? [];
        allGroups.forEach(g => {
          if (!this.selectedGroups.has(g)) this.excludedGroups.add(g);
        });
        this.activeFilterLabel = `Showing: ${[...this.selectedGroups].join(', ')}`;
        break;

      case 'exclude':
        this.selectedGroups.forEach(g => this.excludedGroups.add(g));
        this.activeFilterLabel = `Excluded: ${[...this.selectedGroups].join(', ')}`;
        break;

      case 'sort':
        this.sortAsc = !this.sortAsc;
        break;

      case 'viewTable':
        this.openDataTable();
        break;
    }

    this.actionMenu = emptyActionMenu();
    this.selectedGroups.clear();
    this.draw();
  }

  clearFilters(): void {
    this.excludedGroups.clear();
    this.activeFilterLabel = '';
    this.sortAsc = false;
    this.draw();
  }

  closeDataTable(): void {
    this.dataTable = emptyDataTable();
  }

  private openDataTable(): void {
    const { periods, subgroups } = this.chartData;
    const selected = this.selectedGroups.size > 0
      ? [...this.selectedGroups]
      : periods[0]?.data.map(d => d.group) ?? [];

    const columns = ['Metric', ...periods.flatMap(p => subgroups.map(s => `${p.label} - ${s}`))];
    const rows = selected.map(group => {
      const row: Record<string, string | number> = { Metric: group };
      periods.forEach(p => {
        const datum = p.data.find(d => d.group === group);
        subgroups.forEach(s => {
          row[`${p.label} - ${s}`] = datum ? (datum[s] as number) : 0;
        });
      });
      return row;
    });

    this.dataTable = { visible: true, title: 'Data Table', columns, rows };
  }

  // ── Selection visuals ──────────────────────────────────────────────

  private updateSelectionVisuals(): void {
    const svgSel = d3.select(this.svgRef.nativeElement);
    const selected = this.selectedGroups;
    if (selected.size === 0) {
      svgSel.selectAll('rect[data-group]').attr('opacity', 1);
      svgSel.selectAll('text[data-group]').attr('opacity', 1);
    } else {
      svgSel.selectAll<SVGRectElement, unknown>('rect[data-group]').each(function () {
        const g = this.dataset['group'] ?? '';
        d3.select(this).attr('opacity', selected.has(g) ? 1 : 0.2);
      });
      svgSel.selectAll<SVGTextElement, unknown>('text[data-group]').each(function () {
        const g = this.dataset['group'] ?? '';
        d3.select(this).attr('opacity', selected.has(g) ? 1 : 0.2);
      });
    }
  }

  // ── Draw ───────────────────────────────────────────────────────────

  private draw(): void {
    const { periods, subgroups } = this.chartData;
    if (!periods.length) return;
    const svgEl = this.svgRef.nativeElement;
    d3.select(svgEl).selectAll('*').remove();

    // Apply filters
    const filteredPeriods = periods.map(p => ({
      ...p,
      data: p.data.filter(d => !this.excludedGroups.has(d.group)),
    }));

    // Apply sort
    if (this.sortAsc) {
      const firstPeriod = filteredPeriods[0];
      const sumByGroup = new Map<string, number>();
      firstPeriod.data.forEach(d => {
        sumByGroup.set(d.group, subgroups.reduce((s, k) => s + (d[k] as number), 0));
      });
      const sortedGroups = [...sumByGroup.entries()].sort((a, b) => a[1] - b[1]).map(e => e[0]);
      filteredPeriods.forEach(p => {
        p.data.sort((a, b) => sortedGroups.indexOf(a.group) - sortedGroups.indexOf(b.group));
      });
    }

    const groups = filteredPeriods[0].data.map(d => d.group);
    const containerWidth = this.containerRef.nativeElement.clientWidth - 48;
    const margin = { top: 55, right: 20, bottom: 30, left: 120 };
    const gap = 40;
    const availableWidth = Math.max(500, containerWidth) - margin.left - margin.right;
    const panelWidth = Math.max(150, (availableWidth - (filteredPeriods.length - 1) * gap) / filteredPeriods.length);
    const totalWidth = margin.left + filteredPeriods.length * panelWidth + (filteredPeriods.length - 1) * gap + margin.right;
    const barHeight = 18;
    const groupHeight = subgroups.length * barHeight + 4;
    const chartHeight = Math.max(320, groups.length * groupHeight + margin.top + margin.bottom);
    const height = chartHeight - margin.top - margin.bottom;

    const root = d3
      .select(svgEl)
      .attr('width', totalWidth)
      .attr('height', chartHeight);

    const svg = root
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const color = d3.scaleOrdinal<string>().domain(subgroups).range(d3.schemeTableau10);

    // Shared y-axis
    const y0 = d3
      .scaleBand()
      .domain(groups)
      .range([0, height])
      .padding(0.1);

    const y1 = d3
      .scaleBand()
      .domain(subgroups)
      .range([0, y0.bandwidth()])
      .padding(0.1);

    // Shared x-scale across all periods
    const xMax = d3.max(filteredPeriods, (p) =>
      d3.max(p.data, (d) => Math.max(...subgroups.map((k) => d[k] as number)))
    ) ?? 100;
    const xMin = d3.min(filteredPeriods, (p) =>
      d3.min(p.data, (d) => Math.min(...subgroups.map((k) => d[k] as number)))
    ) ?? 0;

    const x = d3
      .scaleLinear()
      .domain([Math.min(0, xMin), xMax])
      .nice()
      .range([0, panelWidth]);

    // Draw shared y-axis once
    svg.append('g').call(d3.axisLeft(y0));

    // Render each period as a panel
    filteredPeriods.forEach((period, i) => {
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


      // Groups → bars
      const groupSels = panel
        .append('g')
        .selectAll('g')
        .data(period.data)
        .join('g')
        .attr('transform', (d) => `translate(0,${y0(d.group) ?? 0})`);

      const bars = groupSels
        .selectAll('rect')
        .data((d) => subgroups.map((key) => ({ key, value: d[key] as number, group: d.group })))
        .join('rect')
        .attr('data-key', (d) => d.key)
        .attr('data-group', (d) => d.group)
        .attr('y', (d) => y1(d.key) ?? 0)
        .attr('x', (d) => Math.min(x(0), x(d.value)))
        .attr('width', (d) => Math.abs(x(d.value) - x(0)))
        .attr('height', y1.bandwidth())
        .attr('fill', (d) => color(d.key))
        .style('cursor', 'pointer');

      // Value labels at bar ends
      groupSels
        .selectAll<SVGTextElement, SubgroupDatum>('text.label')
        .data((d) => subgroups.map((key) => ({ key, value: d[key] as number, group: d.group })))
        .join('text')
        .attr('class', 'label')
        .attr('data-key', (d) => d.key)
        .attr('data-group', (d) => d.group)
        .attr('x', (d) => d.value >= 0 ? x(d.value) + 4 : x(d.value) - 4)
        .attr('y', (d) => (y1(d.key) ?? 0) + y1.bandwidth() / 2)
        .attr('dominant-baseline', 'middle')
        .attr('text-anchor', (d) => d.value >= 0 ? 'start' : 'end')
        .attr('font-size', '11px')
        .attr('fill', '#64748b')
        .text((d) => d.value);

      // Tooltip
      const typedBars = bars as unknown as d3.Selection<SVGRectElement, SubgroupDatum, SVGGElement, unknown>;

      attachTooltip(typedBars, {
        onUpdate: (state) => {
          if (state.visible && !state.title) {
            this.tooltip = { ...this.tooltip, x: state.x, y: state.y };
          } else {
            this.tooltip = state;
          }
          this.cdr.detectChanges();
        },
      }, (d) => ({
        title: `${d.group} — ${period.label}`,
        rows: [{ color: color(d.key), label: d.key, value: d.value }],
      }), this.containerRef.nativeElement);

      // Click → select group + show action menu
      typedBars.on('click', (event: MouseEvent, d: SubgroupDatum) => {
        event.stopPropagation();
        this.barClick.emit({ datum: d, event });

        if (event.shiftKey) {
          // Multi-select with shift
          if (this.selectedGroups.has(d.group)) {
            this.selectedGroups.delete(d.group);
          } else {
            this.selectedGroups.add(d.group);
          }
        } else {
          this.selectedGroups.clear();
          this.selectedGroups.add(d.group);
        }

        // Mark selected in DOM
        const svgSel = d3.select(svgEl);
        const selectedSet = this.selectedGroups;
        svgSel.selectAll<SVGRectElement, unknown>('rect[data-group]').each(function () {
          const g = this.dataset['group'] ?? '';
          d3.select(this).attr('data-selected', selectedSet.has(g) ? 'true' : 'false');
        });
        svgSel.selectAll<SVGTextElement, unknown>('text[data-group]').each(function () {
          const g = this.dataset['group'] ?? '';
          d3.select(this).attr('data-selected', selectedSet.has(g) ? 'true' : 'false');
        });

        this.updateSelectionVisuals();

        // Show action menu
        const totalValues = subgroups.reduce((sum, k) => {
          let v = 0;
          this.selectedGroups.forEach(g => {
            const row = filteredPeriods[0].data.find(r => r.group === g);
            if (row) v += row[k] as number;
          });
          return sum + v;
        }, 0);

        const cRect = this.containerRef.nativeElement.getBoundingClientRect();
        this.actionMenu = {
          visible: true,
          x: event.clientX - cRect.left + this.containerRef.nativeElement.scrollLeft + 10,
          y: event.clientY - cRect.top + this.containerRef.nativeElement.scrollTop - 10,
          selectedLabels: [...this.selectedGroups],
          summaryText: `Total across subgroups: ${totalValues.toFixed(1)}`,
        };
      });
    });

    // Horizontal legend at top
    const legendItems: LegendItem[] = subgroups.map((key) => ({ label: key, color: color(key) }));
    drawLegend(root, legendItems, margin.left, 12, {
      layout: 'horizontal',
      onHighlight: (highlighted) => {
        const svgSel = d3.select(svgEl);
        subgroups.forEach((key) => {
          const isActive = highlighted === null || key === highlighted;
          svgSel.selectAll(`[data-key="${key}"]`)
            .transition().duration(300)
            .style('opacity', isActive ? 1 : 0.12);
        });
      },
    });
  }
}
