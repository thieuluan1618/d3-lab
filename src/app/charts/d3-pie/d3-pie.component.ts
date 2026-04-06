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
import { PIE_SNIPPETS } from './d3-pie.snippets';

export interface PieDatum {
  label: string;
  value: number;
}

@Component({
  selector: 'app-d3-pie',
  standalone: true,
  imports: [CodeBlockComponent, ChartTooltipComponent, ChartActionMenuComponent, DataTableModalComponent],
  templateUrl: './d3-pie.component.html',
  styleUrl: './d3-pie.component.scss',
})
export class D3PieComponent implements OnInit, OnDestroy, OnChanges {
  @ViewChild('chart', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;
  @ViewChild('chartContainer', { static: true }) private containerRef!: ElementRef<HTMLDivElement>;
  @Input() data: PieDatum[] = [];
  @Output() sliceClick = new EventEmitter<ChartClickEvent<PieDatum>>();

  tooltip: TooltipState = emptyTooltip();
  actionMenu: ActionMenuState = emptyActionMenu();
  dataTable: DataTableConfig = emptyDataTable();
  loading = true;

  // Selection & filter state
  selectedLabels = new Set<string>();
  excludedLabels = new Set<string>();
  activeFilterLabel = '';

  private destroyResize?: () => void;
  private readonly api = inject(MockApiService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly snippets = PIE_SNIPPETS;

  ngOnInit(): void {
    if (this.data.length) {
      this.loading = false;
      this.draw();
    } else {
      this.api.getPieData().subscribe((records) => {
        this.data = records.map((r) => ({ label: r.browser, value: r.share }));
        this.loading = false;
        this.draw();
      });
    }
    this.destroyResize = observeResize(this.containerRef.nativeElement, () => this.draw());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] && !changes['data'].firstChange) {
      this.draw();
    }
  }

  ngOnDestroy(): void {
    this.destroyResize?.();
  }

  // ── Click outside to dismiss ────────────────────���──────────────────

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
        // Sort doesn't apply to pie charts
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
    this.draw();
  }

  closeDataTable(): void {
    this.dataTable = emptyDataTable();
  }

  private openDataTable(): void {
    const selected = this.selectedLabels.size > 0
      ? this.data.filter(d => this.selectedLabels.has(d.label))
      : this.data;

    const columns = ['Label', 'Value (%)'];
    const rows = selected.map(d => ({
      Label: d.label,
      'Value (%)': d.value,
    }));

    this.dataTable = { visible: true, title: 'Pie Chart Data', columns, rows };
  }

  // ── Selection visuals ─────��────────────────────────────────────────

  private updateSelectionVisuals(): void {
    const svgSel = d3.select(this.svgRef.nativeElement);
    const selected = this.selectedLabels;
    if (selected.size === 0) {
      svgSel.selectAll('path[data-label]').attr('opacity', 1);
    } else {
      svgSel.selectAll<SVGPathElement, unknown>('path[data-label]').each(function () {
        const l = this.dataset['label'] ?? '';
        d3.select(this).attr('opacity', selected.has(l) ? 1 : 0.2);
      });
    }
  }

  // ── Draw ────────��──────────────────────────────────────────────────

  private draw(): void {
    if (!this.data.length) return;
    const svgEl = this.svgRef.nativeElement;
    d3.select(svgEl).selectAll('*').remove();

    // Apply filters
    const filtered = this.data.filter(d => !this.excludedLabels.has(d.label));
    if (!filtered.length) return;

    const containerWidth = this.containerRef.nativeElement.clientWidth - 48;
    const maxRadius = 130;
    const legendHeight = 30;
    const radius = Math.min(maxRadius, (containerWidth - 40) / 2);
    const height = radius * 2 + 40 + legendHeight;
    const width = Math.max(300, containerWidth);
    const cx = width / 2;
    const cy = radius + legendHeight + 10;

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

    const arcs = svg.selectAll('arc').data(pie(filtered)).join('g')
      .attr('class', (d) => `slice slice-${d.data.label.replace(/\s+/g, '-')}`);

    arcs
      .append('path')
      .attr('d', arc)
      .attr('data-label', (d) => d.data.label)
      .attr('fill', (d) => color(d.data.label))
      .attr('stroke', 'white')
      .style('stroke-width', '2px')
      .style('cursor', 'pointer');

    attachTooltip(
      arcs.select<SVGPathElement>('path'),
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
      (d: d3.PieArcDatum<PieDatum>) => ({
        title: d.data.label,
        rows: [{ color: color(d.data.label), label: 'Share', value: d.data.value + '%' }],
      }),
      this.containerRef.nativeElement,
    );

    // Click → select + show action menu
    arcs.select<SVGPathElement>('path').on('click', (event: MouseEvent, d: d3.PieArcDatum<PieDatum>) => {
      event.stopPropagation();
      this.sliceClick.emit({ datum: d.data, event });

      if (event.shiftKey) {
        if (this.selectedLabels.has(d.data.label)) {
          this.selectedLabels.delete(d.data.label);
        } else {
          this.selectedLabels.add(d.data.label);
        }
      } else {
        this.selectedLabels.clear();
        this.selectedLabels.add(d.data.label);
      }

      this.updateSelectionVisuals();

      const total = [...this.selectedLabels].reduce((sum, l) => {
        const row = filtered.find(r => r.label === l);
        return sum + (row?.value ?? 0);
      }, 0);

      const cRect = this.containerRef.nativeElement.getBoundingClientRect();
      this.actionMenu = {
        visible: true,
        x: event.clientX - cRect.left + this.containerRef.nativeElement.scrollLeft + 10,
        y: event.clientY - cRect.top + this.containerRef.nativeElement.scrollTop - 10,
        selectedLabels: [...this.selectedLabels],
        summaryText: `Total share: ${total.toFixed(1)}%`,
      };
    });

    arcs
      .append('text')
      .attr('transform', (d) => `translate(${labelArc.centroid(d)})`)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '12px')
      .attr('fill', 'white')
      .style('pointer-events', 'none')
      .text((d) => `${d.data.value}%`);

    // Legend — horizontal at top
    const legendItems: LegendItem[] = filtered.map((d) => ({ label: d.label, color: color(d.label) }));
    drawLegend(root, legendItems, 20, 12, {
      layout: 'horizontal',
      onHighlight: (highlighted) => {
        filtered.forEach((d) => {
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
