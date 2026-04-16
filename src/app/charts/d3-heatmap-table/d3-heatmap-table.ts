import { Component, ElementRef, inject, Input, OnInit, ViewChild } from '@angular/core';
import { NgStyle } from '@angular/common';
import { map } from 'rxjs';
import * as d3 from 'd3';
import { CodeBlockComponent } from '../../shared/components/code-block/code-block.component';
import {
  ChartTooltipComponent,
  TooltipState,
  emptyTooltip,
} from '../../shared/components/chart-tooltip/chart-tooltip.component';
import { MockApiService } from '../../core/services/mock-api.service';
import { ChartTransformService } from '../../core/services/chart-transform.service';
import {
  HeatmapCell,
  HeatmapChart,
  HeatmapColumn,
  HeatmapGroup,
  HeatmapRow,
} from '../../core/models';
import { HEATMAP_TABLE_SNIPPETS } from './d3-heatmap-table.snippets';

export type { HeatmapCell, HeatmapChart, HeatmapColumn, HeatmapGroup, HeatmapRow };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

@Component({
  selector: 'app-d3-heatmap-table',
  standalone: true,
  imports: [CodeBlockComponent, ChartTooltipComponent, NgStyle],
  templateUrl: './d3-heatmap-table.html',
  styleUrl: './d3-heatmap-table.scss',
})
export class D3HeatmapTableComponent implements OnInit {
  @ViewChild('tableContainer', { static: true }) private containerRef!: ElementRef<HTMLDivElement>;
  @Input() chart!: HeatmapChart;

  loading = true;
  tooltip: TooltipState = emptyTooltip();
  hoveredKey: string | null = null; // "segId|geo|year|colKey"
  activeColorFrom = '#ffffff';
  activeColorTo = '#e8590c';
  activeColorSteps = 0; // 0 = continuous

  private colorScale!: d3.ScaleSequential<string> | d3.ScaleQuantize<string>;
  private readonly api = inject(MockApiService);
  private readonly transform = inject(ChartTransformService);

  readonly snippets = HEATMAP_TABLE_SNIPPETS;

  ngOnInit(): void {
    if (this.chart?.segments?.length) {
      this.applyChartColors();
      this.loading = false;
      this.buildColorScale();
    } else {
      this.api
        .getHeatmapData()
        .pipe(map((response) => this.transform.heatmapResponseToChart(response)))
        .subscribe((chart) => {
          this.chart = chart;
          this.applyChartColors();
          this.loading = false;
          this.buildColorScale();
        });
    }
  }

  private applyChartColors(): void {
    if (this.chart.colorFrom) this.activeColorFrom = this.chart.colorFrom;
    if (this.chart.colorTo) this.activeColorTo = this.chart.colorTo;
    if (this.chart.colorSteps) this.activeColorSteps = this.chart.colorSteps;
  }

  onColorFromChange(event: Event): void {
    this.activeColorFrom = (event.target as HTMLInputElement).value;
    this.buildColorScale();
  }

  onColorToChange(event: Event): void {
    this.activeColorTo = (event.target as HTMLInputElement).value;
    this.buildColorScale();
  }

  onColorStepsChange(event: Event): void {
    this.activeColorSteps = +(event.target as HTMLInputElement).value;
    this.buildColorScale();
  }

  // ── Color scale ────────────────────────────────────────────────────

  private buildColorScale(): void {
    const values: number[] = [];
    for (const seg of this.chart.segments) {
      for (const group of seg.groups) {
        for (const row of group.rows) {
          for (const cell of row.cells) {
            if (cell.value !== null) values.push(cell.colorValue ?? cell.value);
          }
        }
      }
    }
    const max = d3.max(values) ?? 100;
    const interpolate = d3.interpolateRgb(this.activeColorFrom, this.activeColorTo);
    if (this.activeColorSteps > 0) {
      const range = d3.range(this.activeColorSteps).map((i) => interpolate(i / (this.activeColorSteps - 1)));
      this.colorScale = d3.scaleQuantize<string>().domain([0, max]).range(range);
    } else {
      this.colorScale = d3.scaleSequential(interpolate).domain([0, max]);
    }
  }

  get legendSteps(): string[] {
    if (this.activeColorSteps <= 0) return [];
    const interpolate = d3.interpolateRgb(this.activeColorFrom, this.activeColorTo);
    return d3.range(this.activeColorSteps).map((i) => interpolate(i / (this.activeColorSteps - 1)));
  }

  getCellBg(cell: HeatmapCell): string {
    if (cell.value === null) return '#f8fafc'; // slate-50
    return this.colorScale(cell.colorValue ?? cell.value);
  }

  getCellTextColor(cell: HeatmapCell): string {
    if (cell.value === null) return '#94a3b8';
    const v = cell.colorValue ?? cell.value;
    const [, hi] = this.colorScale.domain();
    return v / hi > 0.55 ? '#fff' : '#1e293b';
  }

  // ── Row span for market group ──────────────────────────────────────

  getGroupRowSpan(group: HeatmapGroup): number {
    return group.rows.length;
  }

  // ── Cell lookup ────────────────────────────────────────────────────

  getCellByKey(row: HeatmapRow, colKey: string): HeatmapCell {
    return row.cells.find((c) => c.columnKey === colKey) ?? { columnKey: colKey, value: null };
  }

  formatValue(cell: HeatmapCell): string {
    if (cell.value === null) return '';
    return cell.displayValue ?? `${cell.value.toFixed(2)}%`;
  }

  // ── Hover / tooltip ────────────────────────────────────────────────

  cellKey(segId: string, geo: string, year: number, colKey: string): string {
    return `${segId}|${geo}|${year}|${colKey}`;
  }

  onCellEnter(event: MouseEvent, segLabel: string, group: HeatmapGroup, row: HeatmapRow, col: HeatmapColumn, cell: HeatmapCell, segId: string): void {
    this.hoveredKey = this.cellKey(segId, group.marketName, row.year, col.key);
    const rect = this.containerRef.nativeElement.getBoundingClientRect();
    const rows = [
      { label: col.label, value: this.formatValue(cell) },
    ];
    if (cell.sampleSize !== undefined) {
      rows.push({ label: 'Respondents', value: cell.sampleSize.toString() });
    }
    this.tooltip = {
      visible: true,
      x: event.clientX - rect.left + this.containerRef.nativeElement.scrollLeft,
      y: event.clientY - rect.top + this.containerRef.nativeElement.scrollTop,
      title: `${group.marketName} · ${row.year}`,
      rows,
    };
  }

  onCellMove(event: MouseEvent): void {
    if (!this.tooltip.visible) return;
    const rect = this.containerRef.nativeElement.getBoundingClientRect();
    this.tooltip = {
      ...this.tooltip,
      x: event.clientX - rect.left + this.containerRef.nativeElement.scrollLeft,
      y: event.clientY - rect.top + this.containerRef.nativeElement.scrollTop,
    };
  }

  onCellLeave(): void {
    this.hoveredKey = null;
    this.tooltip = emptyTooltip();
  }

  isHoveredCell(segId: string, geo: string, year: number, colKey: string): boolean {
    return this.hoveredKey === this.cellKey(segId, geo, year, colKey);
  }

  isDimmed(): boolean {
    return this.hoveredKey !== null;
  }
}
