import { Component, ElementRef, inject, Input, OnInit, ViewChild } from '@angular/core';
import { NgStyle } from '@angular/common';
import * as d3 from 'd3';
import { CodeBlockComponent } from '../../shared/components/code-block/code-block.component';
import {
  ChartTooltipComponent,
  TooltipState,
  emptyTooltip,
} from '../../shared/components/chart-tooltip/chart-tooltip.component';
import { MockApiService } from '../../core/services/mock-api.service';
import { HEATMAP_TABLE_SNIPPETS } from './d3-heatmap-table.snippets';

export interface HeatmapCell {
  row: string;
  col: string;
  value: number;
}

export interface HeatmapTableData {
  rows: string[];
  columns: string[];
  cells: HeatmapCell[];
}

@Component({
  selector: 'app-d3-heatmap-table',
  standalone: true,
  imports: [CodeBlockComponent, ChartTooltipComponent, NgStyle],
  templateUrl: './d3-heatmap-table.html',
  styleUrl: './d3-heatmap-table.scss',
})
export class D3HeatmapTableComponent implements OnInit {
  @ViewChild('tableContainer', { static: true }) private containerRef!: ElementRef<HTMLDivElement>;
  @Input() data: HeatmapTableData = { rows: [], columns: [], cells: [] };
  @Input() valueFormat: (v: number) => string = (v) => v.toFixed(1);

  loading = true;
  hoveredCell: HeatmapCell | null = null;
  tooltip: TooltipState = emptyTooltip();

  private colorScale!: d3.ScaleSequential<string>;
  private readonly api = inject(MockApiService);

  readonly snippets = HEATMAP_TABLE_SNIPPETS;

  ngOnInit(): void {
    if (this.data.cells.length) {
      this.loading = false;
      this.buildColorScale();
    } else {
      this.api.getHeatmapData().subscribe((response) => {
        this.data = response;
        this.valueFormat = (v) => v.toFixed(1);
        this.loading = false;
        this.buildColorScale();
      });
    }
  }

  private buildColorScale(): void {
    const values = this.data.cells.map((c) => c.value);
    this.colorScale = d3
      .scaleSequential(d3.interpolateYlOrRd)
      .domain([d3.min(values) ?? 0, d3.max(values) ?? 100]);
  }

  getCellValue(row: string, col: string): number {
    return this.data.cells.find((c) => c.row === row && c.col === col)?.value ?? 0;
  }

  getCellBg(row: string, col: string): string {
    return this.colorScale(this.getCellValue(row, col));
  }

  getCellTextColor(row: string, col: string): string {
    const value = this.getCellValue(row, col);
    const [lo, hi] = this.colorScale.domain();
    const ratio = (value - lo) / (hi - lo);
    return ratio > 0.6 ? '#fff' : '#1e293b';
  }

  onCellEnter(event: MouseEvent, row: string, col: string): void {
    this.hoveredCell = { row, col, value: this.getCellValue(row, col) };
    const rect = this.containerRef.nativeElement.getBoundingClientRect();
    const x = event.clientX - rect.left + this.containerRef.nativeElement.scrollLeft;
    const y = event.clientY - rect.top + this.containerRef.nativeElement.scrollTop;
    this.tooltip = {
      visible: true,
      x,
      y,
      title: `${row} — ${col}`,
      rows: [
        { label: 'Value', value: this.valueFormat(this.getCellValue(row, col)) },
        { label: 'Row Avg', value: this.valueFormat(this.getRowAvg(row)) },
        { label: 'Col Avg', value: this.valueFormat(this.getColAvg(col)) },
      ],
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
    this.hoveredCell = null;
    this.tooltip = emptyTooltip();
  }

  private getRowAvg(row: string): number {
    const rowCells = this.data.cells.filter((c) => c.row === row);
    return rowCells.reduce((sum, c) => sum + c.value, 0) / rowCells.length;
  }

  private getColAvg(col: string): number {
    const colCells = this.data.cells.filter((c) => c.col === col);
    return colCells.reduce((sum, c) => sum + c.value, 0) / colCells.length;
  }
}
