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
import { initSvg, attachTooltip, observeResize } from '../../core/utils/d3.helpers';
import { ChartClickEvent } from '../../core/models';
import { MockApiService } from '../../core/services/mock-api.service';
import { BULLET_SNIPPETS } from './d3-bullet.snippets';

export interface BulletDatum {
  label: string;
  value: number;
}

@Component({
  selector: 'app-d3-bullet',
  standalone: true,
  imports: [CodeBlockComponent, ChartTooltipComponent, ChartActionMenuComponent, DataTableModalComponent],
  templateUrl: './d3-bullet.component.html',
  styleUrl: './d3-bullet.component.scss',
})
export class D3BulletComponent implements OnInit, OnDestroy, OnChanges {
  @ViewChild('chart', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;
  @ViewChild('chartContainer', { static: true }) private containerRef!: ElementRef<HTMLDivElement>;
  @Input() data: BulletDatum[] = [];
  @Input() referenceLine = 100;
  @Output() barClick = new EventEmitter<ChartClickEvent<BulletDatum>>();

  tooltip: TooltipState = emptyTooltip();
  actionMenu: ActionMenuState = emptyActionMenu();
  dataTable: DataTableConfig = emptyDataTable();
  showGrid = true;
  loading = true;

  // Selection & filter state
  selectedLabels = new Set<string>();
  excludedLabels = new Set<string>();
  private sortAsc = false;
  activeFilterLabel = '';

  private destroyResize?: () => void;
  private readonly api = inject(MockApiService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly snippets = BULLET_SNIPPETS;

  ngOnInit(): void {
    if (this.data.length) {
      this.loading = false;
      this.draw();
    } else {
      this.api.getBulletData().subscribe((records) => {
        this.data = records.map((r) => ({ label: r.category, value: r.score }));
        this.loading = false;
        this.draw();
      });
    }
    this.destroyResize = observeResize(this.containerRef.nativeElement, () => this.draw());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['data'] || changes['referenceLine']) && !(changes['data']?.firstChange)) {
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
        const allLabels = this.data.map(d => d.label);
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
    const selected = this.selectedLabels.size > 0
      ? this.data.filter(d => this.selectedLabels.has(d.label))
      : this.data;

    const columns = ['Label', 'Index Score'];
    const rows = selected.map(d => ({
      Label: d.label,
      'Index Score': d.value,
    }));

    this.dataTable = { visible: true, title: 'Bullet Chart Data', columns, rows };
  }

  // ── Selection visuals ──────────────────────────────────────────────

  private updateSelectionVisuals(): void {
    const svgSel = d3.select(this.svgRef.nativeElement);
    const selected = this.selectedLabels;
    if (selected.size === 0) {
      svgSel.selectAll('rect.bar[data-label]').attr('opacity', 1);
    } else {
      svgSel.selectAll<SVGRectElement, unknown>('rect.bar[data-label]').each(function () {
        const l = this.dataset['label'] ?? '';
        d3.select(this).attr('opacity', selected.has(l) ? 1 : 0.2);
      });
    }
  }

  // ── Draw ───────────────────────────────────────────────────────────

  private draw(): void {
    if (!this.data.length) return;
    const svgEl = this.svgRef.nativeElement;
    d3.select(svgEl).selectAll('*').remove();

    // Apply filters
    let filtered = this.data.filter(d => !this.excludedLabels.has(d.label));

    // Apply sort
    if (this.sortAsc) {
      filtered = [...filtered].sort((a, b) => a.value - b.value);
    } else {
      filtered = [...filtered].sort((a, b) => b.value - a.value);
    }

    const containerWidth = this.containerRef.nativeElement.clientWidth - 48;
    const totalWidth = Math.max(400, containerWidth);
    const margin = { top: 20, right: 60, bottom: 30, left: 130 };
    const chartHeight = Math.max(350, filtered.length * 38);
    const { g: svg, width, height } = initSvg(svgEl, totalWidth, chartHeight, margin);

    const y = d3
      .scaleBand()
      .domain(filtered.map((d) => d.label))
      .range([0, height])
      .padding(0.25);

    const x = d3
      .scaleLinear()
      .domain([0, Math.ceil((d3.max(filtered, (d) => d.value) ?? 210) / 10) * 10])
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
      .data(filtered)
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
      .data(filtered)
      .join('rect')
      .attr('class', 'bar')
      .attr('data-label', (d) => d.label)
      .attr('x', 0)
      .attr('y', (d) => y(d.label) ?? 0)
      .attr('width', (d) => x(d.value))
      .attr('height', y.bandwidth())
      .attr('fill', '#3b82f6')
      .attr('rx', 3)
      .style('cursor', 'pointer');

    // Value labels
    svg
      .selectAll<SVGTextElement, BulletDatum>('.value-label')
      .data(filtered)
      .join('text')
      .attr('class', 'value-label')
      .attr('x', (d) => x(d.value) + 4)
      .attr('y', (d) => (y(d.label) ?? 0) + y.bandwidth() / 2)
      .attr('dy', '0.35em')
      .attr('font-size', '12px')
      .attr('fill', '#334155')
      .text((d) => d.value.toFixed(1));

    // Dashed reference line
    gridGroup
      .append('line')
      .attr('x1', x(this.referenceLine))
      .attr('x2', x(this.referenceLine))
      .attr('y1', 0)
      .attr('y2', height)
      .attr('stroke', '#94a3b8')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4 3');

    gridGroup
      .append('text')
      .attr('x', x(this.referenceLine))
      .attr('y', -6)
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('fill', '#64748b')
      .text(`Index ${this.referenceLine}`);

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
          this.cdr.detectChanges();
        },
      },
      (d) => ({
        title: d.label,
        rows: [{ label: 'Index Score', value: d.value }],
      }),
      this.containerRef.nativeElement,
    );

    // Click → select + show action menu
    bars.on('click', (event: MouseEvent, d: BulletDatum) => {
      event.stopPropagation();
      this.barClick.emit({ datum: d, event });

      if (event.shiftKey) {
        if (this.selectedLabels.has(d.label)) {
          this.selectedLabels.delete(d.label);
        } else {
          this.selectedLabels.add(d.label);
        }
      } else {
        this.selectedLabels.clear();
        this.selectedLabels.add(d.label);
      }

      this.updateSelectionVisuals();

      const totalScore = [...this.selectedLabels].reduce((sum, l) => {
        const row = filtered.find(r => r.label === l);
        return sum + (row?.value ?? 0);
      }, 0);

      const cRect = this.containerRef.nativeElement.getBoundingClientRect();
      this.actionMenu = {
        visible: true,
        x: event.clientX - cRect.left + this.containerRef.nativeElement.scrollLeft + 10,
        y: event.clientY - cRect.top + this.containerRef.nativeElement.scrollTop - 10,
        selectedLabels: [...this.selectedLabels],
        summaryText: `Avg score: ${(totalScore / this.selectedLabels.size).toFixed(1)}`,
      };
    });
  }

  toggleGrid(): void {
    this.showGrid = !this.showGrid;
    const svgEl = d3.select(this.svgRef.nativeElement);
    svgEl.select('.grid-lines').attr('display', this.showGrid ? null : 'none');
    svgEl.select('.minimal-labels').attr('display', this.showGrid ? 'none' : null);
  }
}
