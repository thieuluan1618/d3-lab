import { Component, Input } from '@angular/core';
import { NgStyle } from '@angular/common';

export interface TooltipRow {
  color?: string;
  label: string;
  value: string | number;
}

export interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  title: string;
  rows: TooltipRow[];
}

export function emptyTooltip(): TooltipState {
  return { visible: false, x: 0, y: 0, title: '', rows: [] };
}

@Component({
  selector: 'app-chart-tooltip',
  standalone: true,
  imports: [NgStyle],
  templateUrl: './chart-tooltip.component.html',
  styleUrl: './chart-tooltip.component.scss',
})
export class ChartTooltipComponent {
  @Input() state: TooltipState = emptyTooltip();
}
