import { Injectable } from '@angular/core';
import {
  ChartPoint,
  ChartSeries,
  MetricRecord,
  PeriodData,
  TooltipSeries,
} from '../models';

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
}
