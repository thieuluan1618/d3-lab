import { Injectable } from '@angular/core';
import {
  ChartPoint,
  ChartSeries,
  HeatmapCell,
  HeatmapChart,
  HeatmapGroup,
  HeatmapRow,
  HeatmapSegment,
  MetricRecord,
  PeriodData,
  TooltipSeries,
} from '../models';
import { ApiHeatmapResponse } from './mock-api.service';

/**
 * ChartTransformService
 *
 * Responsible for converting raw API data (PeriodData / MetricRecord[])
 * into chart-ready models (ChartSeries / ChartPoint[]).
 *
 * Keep all data transformation here — never inside D3 components.
 * This mirrors Tableau's "calculated fields" and "table calculations"
 * but in a testable, typed service layer.
 */
@Injectable({ providedIn: 'root' })
export class ChartTransformService {

  /**
   * Transform multiple periods into a flat array of ChartSeries.
   * Each period becomes one series — ready for multi-period line/bar charts.
   */
  toMultiPeriodSeries(
    periods: PeriodData[],
    xKey: keyof MetricRecord = 'date',
    yKey: keyof MetricRecord = 'value',
    seriesLabel?: (period: string) => string
  ): ChartSeries[] {
    return periods.map((p) => ({
      id: p.period,
      label: seriesLabel ? seriesLabel(p.period) : p.period,
      period: p.period,
      points: p.records.map((r) => ({
        x: r[xKey] as string | number,
        y: r[yKey] as number,
        raw: r,
      })),
    }));
  }

  /**
   * Calculate period-over-period delta for tooltip enrichment.
   * Pass current + previous series at the same x value.
   *
   * Equivalent to Tableau's table calculation: "Difference from previous"
   */
  enrichWithDelta(
    current: TooltipSeries,
    previous: TooltipSeries | undefined
  ): TooltipSeries {
    if (!previous) return current;

    const delta = current.value - previous.value;
    const deltaPercent = previous.value !== 0
      ? (delta / previous.value) * 100
      : undefined;

    return { ...current, delta, deltaPercent };
  }

  /**
   * Calculate % of total for pie charts.
   * Equivalent to Tableau's table calculation: "Percent of Total"
   */
  toPercentOfTotal(points: ChartPoint[]): ChartPoint[] {
    const total = points.reduce((sum, p) => sum + p.y, 0);
    return points.map((p) => ({
      ...p,
      y: total > 0 ? (p.y / total) * 100 : 0,
    }));
  }

  /**
   * Transform the heatmap API response into the nested `HeatmapChart` model
   * consumed by `<app-d3-heatmap-table>`.
   *
   * For each segment, its flat `data[]` is grouped:
   *   marketName → year → cells
   *
   * Segment order honors `response.segments` (BE-defined). Markets are
   * emitted in first-seen order. Years are sorted ascending.
   */
  heatmapResponseToChart(response: ApiHeatmapResponse): HeatmapChart {
    const sortedColumns = [...response.columns].sort((a, b) => a.order - b.order);
    const yearsSet = new Set<number>();

    interface GroupAccum { marketType: string; rows: Map<number, HeatmapCell[]> }

    const segments: HeatmapSegment[] = response.segments.map((segMeta) => {
      const marketMap = new Map<string, GroupAccum>();

      for (const d of segMeta.data) {
        yearsSet.add(d.year);

        let grp = marketMap.get(d.marketName);
        if (!grp) {
          grp = { marketType: d.marketType, rows: new Map() };
          marketMap.set(d.marketName, grp);
        }

        let cells = grp.rows.get(d.year);
        if (!cells) {
          cells = [];
          grp.rows.set(d.year, cells);
        }

        cells.push({
          columnKey: d.columnKey,
          value: d.value,
          displayValue: d.value !== null ? `${d.value.toFixed(2)}%` : undefined,
          sampleSize: d.sampleSize,
        });
      }

      const groups: HeatmapGroup[] = [];
      for (const [marketName, grp] of marketMap) {
        const rows: HeatmapRow[] = [...grp.rows.entries()]
          .sort(([a], [b]) => a - b)
          .map(([year, cells]) => ({ year, cells }));
        groups.push({ marketType: grp.marketType, marketName, rows });
      }

      return { id: segMeta.id, label: segMeta.label, columns: sortedColumns, groups };
    });

    return {
      id: response.id,
      serviceLine: response.serviceLine,
      category: response.category,
      question: response.question,
      years: [...yearsSet].sort((a, b) => a - b),
      segments,
    };
  }
}
