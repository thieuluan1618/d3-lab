import { Component, EventEmitter, Input, Output } from '@angular/core';

export type ChartAction = 'keepOnly' | 'exclude' | 'sort' | 'viewTable';

export interface ActionMenuState {
  visible: boolean;
  x: number;
  y: number;
  selectedLabels: string[];
  summaryText: string;
}

export function emptyActionMenu(): ActionMenuState {
  return { visible: false, x: 0, y: 0, selectedLabels: [], summaryText: '' };
}

@Component({
  selector: 'app-chart-action-menu',
  standalone: true,
  imports: [],
  templateUrl: './chart-action-menu.component.html',
  styleUrl: './chart-action-menu.component.scss',
})
export class ChartActionMenuComponent {
  @Input() state: ActionMenuState = emptyActionMenu();
  @Output() action = new EventEmitter<ChartAction>();
  @Output() dismiss = new EventEmitter<void>();

  onAction(type: ChartAction): void {
    this.action.emit(type);
  }

  onDismiss(event: MouseEvent): void {
    event.stopPropagation();
    this.dismiss.emit();
  }
}
