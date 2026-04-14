import { Injectable } from '@angular/core';
import { Observable, of, delay } from 'rxjs';

// ---------------------------------------------------------------------------
// Raw API response shapes — what a real backend would return
// ---------------------------------------------------------------------------

export interface ApiBarRecord {
  month: string;
  revenue: number;
}

export interface ApiPieRecord {
  browser: string;
  share: number;
}

export interface ApiLineRecord {
  month: string;
  revenue: number;
  cost: number;
  profit: number;
}

export interface ApiHbarGroupRecord {
  metric: string;
  [company: string]: string | number;
}

export interface ApiHbarGroupResponse {
  period: string;
  companies: string[];
  records: ApiHbarGroupRecord[];
}

export interface ApiStackRecord {
  company: string;
  promoters: number;
  neutrals: number;
  detractors: number;
}

export interface ApiBulletRecord {
  category: string;
  score: number;
}

export interface ApiHeatmapTableData {
  rows: string[];
  columns: string[];
  cells: { row: string; col: string; value: number }[];
}

export interface ApiLineSeriesRecord {
  name: string;
  values: { month: string; value: number }[];
}

// ---------------------------------------------------------------------------
// Mock API Service — simulates async backend responses
// ---------------------------------------------------------------------------

@Injectable({ providedIn: 'root' })
export class MockApiService {
  private readonly DELAY_MS = 300;

  // ── Bar Chart: Monthly revenue ──────────────────────────────────────
  getBarData(): Observable<ApiBarRecord[]> {
    return of([
      { month: 'Jan', revenue: 42500 },
      { month: 'Feb', revenue: 38200 },
      { month: 'Mar', revenue: 51800 },
      { month: 'Apr', revenue: 47600 },
      { month: 'May', revenue: 55400 },
      { month: 'Jun', revenue: 63100 },
      { month: 'Jul', revenue: 58900 },
      { month: 'Aug', revenue: 67200 },
      { month: 'Sep', revenue: 61800 },
      { month: 'Oct', revenue: 72500 },
      { month: 'Nov', revenue: 69300 },
      { month: 'Dec', revenue: 78400 },
    ]).pipe(delay(this.DELAY_MS));
  }

  // ── Pie Chart: Market share ─────────────────────────────────────────
  getPieData(): Observable<ApiPieRecord[]> {
    return of([
      { browser: 'Chrome', share: 63.5 },
      { browser: 'Safari', share: 18.7 },
      { browser: 'Edge', share: 5.2 },
      { browser: 'Firefox', share: 4.8 },
      { browser: 'Samsung Internet', share: 2.9 },
      { browser: 'Other', share: 4.9 },
    ]).pipe(delay(this.DELAY_MS));
  }

  // ── Line Chart: Multi-series monthly trend ──────────────────────────
  getLineData(): Observable<ApiLineSeriesRecord[]> {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return of([
      {
        name: 'Revenue',
        values: [42.5, 38.2, 51.8, 47.6, 55.4, 63.1, 58.9, 67.2, 61.8, 72.5, 69.3, 78.4]
          .map((v, i) => ({ month: months[i], value: v })),
      },
      {
        name: 'Cost',
        values: [28.0, 25.5, 32.4, 30.1, 34.7, 38.2, 36.5, 41.8, 39.0, 44.5, 42.1, 47.3]
          .map((v, i) => ({ month: months[i], value: v })),
      },
      {
        name: 'Profit',
        values: [14.5, 12.7, 19.4, 17.5, 20.7, 24.9, 22.4, 25.4, 22.8, 28.0, 27.2, 31.1]
          .map((v, i) => ({ month: months[i], value: v })),
      },
    ]).pipe(delay(this.DELAY_MS));
  }

  // ── Horizontal Grouped Bar: Loyalty Index by company ────────────────
  // Inspired by real Tableau Loyalty Index dashboard
  getHbarGroupData(): Observable<ApiHbarGroupResponse[]> {
    return of([
      {
        period: 'Q3 2024',
        companies: ['Bellin Health', 'Hospital Sisters', 'Aurora Health', 'ThedaCare'],
        records: [
          { metric: 'Loyalty Index', 'Bellin Health': 71.1, 'Hospital Sisters': 63.2, 'Aurora Health': 43.5, 'ThedaCare': 38.8 },
          { metric: 'Brand Score', 'Bellin Health': 77.1, 'Hospital Sisters': 67.1, 'Aurora Health': 53.5, 'ThedaCare': 38.0 },
          { metric: 'Engagement', 'Bellin Health': 66.3, 'Hospital Sisters': 61.5, 'Aurora Health': 44.8, 'ThedaCare': 35.5 },
          { metric: 'Need', 'Bellin Health': 70.9, 'Hospital Sisters': 64.8, 'Aurora Health': 48.0, 'ThedaCare': 42.3 },
          { metric: 'Access (CES)', 'Bellin Health': 65.1, 'Hospital Sisters': 60.1, 'Aurora Health': 40.8, 'ThedaCare': 37.5 },
          { metric: 'Motivation', 'Bellin Health': 72.2, 'Hospital Sisters': 65.1, 'Aurora Health': 46.3, 'ThedaCare': 39.2 },
          { metric: 'Experience', 'Bellin Health': 77.1, 'Hospital Sisters': 55.7, 'Aurora Health': 44.3, 'ThedaCare': 36.8 },
        ],
      },
      {
        period: 'Q3 2025',
        companies: ['Bellin Health', 'Hospital Sisters', 'Aurora Health', 'ThedaCare'],
        records: [
          { metric: 'Loyalty Index', 'Bellin Health': 73.5, 'Hospital Sisters': 65.8, 'Aurora Health': 45.2, 'ThedaCare': 40.1 },
          { metric: 'Brand Score', 'Bellin Health': 79.3, 'Hospital Sisters': 69.4, 'Aurora Health': 55.1, 'ThedaCare': 39.8 },
          { metric: 'Engagement', 'Bellin Health': 68.7, 'Hospital Sisters': 63.2, 'Aurora Health': 46.5, 'ThedaCare': 37.2 },
          { metric: 'Need', 'Bellin Health': 72.4, 'Hospital Sisters': 66.9, 'Aurora Health': 49.8, 'ThedaCare': 44.0 },
          { metric: 'Access (CES)', 'Bellin Health': 67.3, 'Hospital Sisters': 62.4, 'Aurora Health': 42.5, 'ThedaCare': 39.1 },
          { metric: 'Motivation', 'Bellin Health': 74.8, 'Hospital Sisters': 67.3, 'Aurora Health': 48.1, 'ThedaCare': 41.0 },
          { metric: 'Experience', 'Bellin Health': 79.5, 'Hospital Sisters': 58.2, 'Aurora Health': 46.0, 'ThedaCare': 38.5 },
        ],
      },
    ]).pipe(delay(this.DELAY_MS));
  }

  // ── Horizontal Stacked Bar: NPS breakdown by company ────────────────
  getHbarStackData(): Observable<ApiStackRecord[]> {
    return of([
      { company: 'Bellin Health',      promoters: 48.8, neutrals: 30.7, detractors: 20.5 },
      { company: 'Hospital Sisters',   promoters: 42.3, neutrals: 28.5, detractors: 29.2 },
      { company: 'Aurora Health Care', promoters: 38.2, neutrals: 35.1, detractors: 26.7 },
      { company: 'ThedaCare',          promoters: 34.0, neutrals: 25.5, detractors: 40.5 },
      { company: 'Ascension',          promoters: 44.1, neutrals: 31.2, detractors: 24.7 },
      { company: 'Marshfield Clinic',  promoters: 51.3, neutrals: 27.8, detractors: 20.9 },
    ]).pipe(delay(this.DELAY_MS));
  }

  // ── Heat Map Table: Company × metric matrix ─────────────────────────
  getHeatmapData(): Observable<ApiHeatmapTableData> {
    const rows = ['Bellin Health', 'Hospital Sisters', 'Aurora Health', 'ThedaCare', 'Ascension', 'Marshfield Clinic'];
    const columns = ['Loyalty Index', 'Brand Score', 'Engagement', 'Need', 'Access (CES)', 'Motivation', 'Experience'];
    const matrix: Record<string, number[]> = {
      'Bellin Health':     [73.5, 79.3, 68.7, 72.4, 67.3, 74.8, 79.5],
      'Hospital Sisters':  [65.8, 69.4, 63.2, 66.9, 62.4, 67.3, 58.2],
      'Aurora Health':     [45.2, 55.1, 46.5, 49.8, 42.5, 48.1, 46.0],
      'ThedaCare':         [40.1, 39.8, 37.2, 44.0, 39.1, 41.0, 38.5],
      'Ascension':         [61.2, 64.5, 59.8, 63.1, 57.9, 62.4, 60.3],
      'Marshfield Clinic': [69.8, 72.1, 65.4, 68.7, 64.2, 70.5, 67.8],
    };
    const cells = rows.flatMap((row) =>
      columns.map((col, ci) => ({ row, col, value: matrix[row][ci] })),
    );
    return of({ rows, columns, cells }).pipe(delay(this.DELAY_MS));
  }

  // ── Bullet / Ranked Bar: Category index scores ──────────────────────
  getBulletData(): Observable<ApiBulletRecord[]> {
    return of([
      { category: 'Primary Care',      score: 207.4 },
      { category: 'All Health Needs',   score: 206.1 },
      { category: 'Heart Care',         score: 175.3 },
      { category: 'Cancer Care',        score: 160.8 },
      { category: 'Orthopedic Care',    score: 148.2 },
      { category: 'Emergency Care',     score: 132.5 },
      { category: 'Mental Health',      score: 115.7 },
      { category: 'Urgent Care',        score: 98.4 },
      { category: 'Pediatric Care',     score: 88.1 },
      { category: 'Women\'s Health',    score: 142.9 },
    ]).pipe(delay(this.DELAY_MS));
  }
}
