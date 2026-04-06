import { Component, EventEmitter, Input, Output } from '@angular/core';

export interface DataTableConfig {
  visible: boolean;
  title: string;
  columns: string[];
  rows: Record<string, string | number>[];
}

export function emptyDataTable(): DataTableConfig {
  return { visible: false, title: '', columns: [], rows: [] };
}

@Component({
  selector: 'app-data-table-modal',
  standalone: true,
  imports: [],
  templateUrl: './data-table-modal.component.html',
  styleUrl: './data-table-modal.component.scss',
})
export class DataTableModalComponent {
  @Input() config: DataTableConfig = emptyDataTable();
  @Output() close = new EventEmitter<void>();
}
