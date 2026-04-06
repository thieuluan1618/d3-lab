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
import { BAR_SNIPPETS } from './d3-bar.snippets';

export interface BarDatum {
  label: string;
  value: number;
}

@Component({
  selector: 'app-d3-bar',
  standalone: true,
  imports: [CodeBlockComponent, ChartTooltipComponent, ChartActionMenuComponent, DataTableModalComponent],
  templateUrl: './d3-bar.component.html',
  styleUrl: './d3-bar.component.scss',
})
export class D3BarComponent implements OnInit, OnDestroy, OnChanges {
  @ViewChild('chart', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;
  @ViewChild('chartContainer', { static: true }) private containerRef!: ElementRef<HTMLDivElement>;
  @Input() data: BarDatum[] = [];
  @Input() valueFormat: (v: number) => string = (v) => v.toLocaleString();
  @Output() barClick = new EventEmitter<ChartClickEvent<BarDatum>>();

  tooltip: TooltipState = emptyTooltip();
  actionMenu: ActionMenuState = emptyActionMenu();
  dataTable: DataTableConfig = emptyDataTable();
  loading = true;

  // Selection & filter state
  selectedLabels = new Set<string>();
  excludedLabels = new Set<string>();
  private sortAsc = false;
  activeFilterLabel = '';

  private destroyResize?: () => void;
  private readonly api = inject(MockApiService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly snippets = BAR_SNIPPETS;

  ngOnInit(): void {
    if (this.data.length) {
      this.loading = false;
      this.draw();
    } else {
      this.api.getBarData().subscribe((records) => {
        this.data = records.map((r) => ({ label: r.month, value: r.revenue }));
        this.valueFormat = (v) => `$${(v / 1000).toFixed(1)}k`;
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

    const columns = ['Label', 'Value'];
    const rows = selected.map(d => ({
      Label: d.label,
      Value: d.value,
    }));

    this.dataTable = { visible: true, title: 'Bar Chart Data', columns, rows };
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
    if (!this.data.length) return;
    const svgEl = this.svgRef.nativeElement;
    d3.select(svgEl).selectAll('*').remove();

    // Apply filters
    let filtered = this.data.filter(d => !this.excludedLabels.has(d.label));

    // Apply sort
    if (this.sortAsc) {
      filtered = [...filtered].sort((a, b) => a.value - b.value);
    }

    const containerWidth = this.containerRef.nativeElement.clientWidth - 48;
    const totalWidth = Math.max(400, containerWidth);
    const margin = { top: 20, right: 20, bottom: 40, left: 50 };
    const { g: svg, width, height } = initSvg(svgEl, totalWidth, 350, margin);

    const x = d3
      .scaleBand()
      .domain(filtered.map((d) => d.label))
      .range([0, width])
      .padding(0.3);

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(filtered, (d) => d.value) ?? 100])
      .nice()
      .range([height, 0]);

    svg
      .append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x));

    svg.append('g').call(d3.axisLeft(y));

    const bars = svg
      .selectAll<SVGRectElement, BarDatum>('.bar')
      .data(filtered)
      .join('rect')
      .attr('class', 'bar')
      .attr('data-label', (d) => d.label)
      .attr('x', (d) => x(d.label) ?? 0)
      .attr('y', (d) => y(d.value))
      .attr('width', x.bandwidth())
      .attr('height', (d) => height - y(d.value))
      .attr('fill', 'steelblue')
      .style('cursor', 'pointer');

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
        rows: [{ label: 'Value', value: this.valueFormat(d.value) }],
      }),
      this.containerRef.nativeElement,
    );

    // Click → select + show action menu
    bars.on('click', (event: MouseEvent, d: BarDatum) => {
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

      const cRect = this.containerRef.nativeElement.getBoundingClientRect();
      this.actionMenu = {
        visible: true,
        x: event.clientX - cRect.left + this.containerRef.nativeElement.scrollLeft + 10,
        y: event.clientY - cRect.top + this.containerRef.nativeElement.scrollTop - 10,
        selectedLabels: [...this.selectedLabels],
        summaryText: `Total: ${this.valueFormat([...this.selectedLabels].reduce((sum, l) => {
          const row = filtered.find(r => r.label === l);
          return sum + (row?.value ?? 0);
        }, 0))}`,
      };
    });
  }
}
