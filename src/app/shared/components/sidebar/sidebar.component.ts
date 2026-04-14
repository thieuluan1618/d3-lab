import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface NavSection {
  title: string;
  items: NavItem[];
}

interface NavItem {
  label: string;
  route: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  sections: NavSection[] = [
    {
      title: 'Getting Started',
      items: [
        { label: 'Introduction', route: '/home' },
        // { label: 'Tableau → D3 Concept Map', route: '/tableau-d3' },
        { label: 'Data Models Guide', route: '/models' },
        { label: 'AI for Developers', route: '/ai-guide' },
      ],
    },
    {
      title: 'Chart Examples',
      items: [
        { label: 'Bar Chart', route: '/guide/bar' },
        { label: 'Pie Chart', route: '/guide/pie' },
        { label: 'Horizontal Grouped Bar', route: '/guide/hbar-group' },
        { label: 'Horizontal Stacked Bar', route: '/guide/hbar-stack' },
        { label: 'Bullet / Ranked Bar', route: '/guide/bullet' },
        { label: 'Line Chart', route: '/guide/line' },
        { label: 'Heat Map Table', route: '/guide/heatmap-table' },
      ],
    },
  ];
}
