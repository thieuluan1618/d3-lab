import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },

  // Getting Started
  {
    path: 'home',
    loadComponent: () => import('./pages/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'tableau-d3',
    loadComponent: () => import('./pages/tableau-d3/tableau-d3.component').then((m) => m.TableauD3Component),
  },
  {
    path: 'models',
    loadComponent: () => import('./pages/models-guide/models-guide.component').then((m) => m.ModelsGuideComponent),
  },
  {
    path: 'ai-guide',
    loadComponent: () => import('./pages/ai-guide/ai-guide.component').then((m) => m.AiGuideComponent),
  },

  // Chart Examples
  {
    path: 'guide/bar',
    loadComponent: () => import('./charts/d3-bar/d3-bar.component').then((m) => m.D3BarComponent),
  },
  {
    path: 'guide/pie',
    loadComponent: () => import('./charts/d3-pie/d3-pie.component').then((m) => m.D3PieComponent),
  },
  {
    path: 'guide/hbar-group',
    loadComponent: () => import('./charts/d3-hbar-group/d3-hbar-group.component').then((m) => m.D3HbarGroupComponent),
  },
  {
    path: 'guide/line',
    loadComponent: () => import('./charts/d3-line/d3-line.component').then((m) => m.D3LineComponent),
  },
  {
    path: 'guide/hbar-stack',
    loadComponent: () => import('./charts/d3-hbar-stack/d3-hbar-stack.component').then((m) => m.D3HbarStackComponent),
  },
  {
    path: 'guide/bullet',
    loadComponent: () => import('./charts/d3-bullet/d3-bullet.component').then((m) => m.D3BulletComponent),
  },
  {
    path: 'guide/heatmap-table',
    loadComponent: () => import('./charts/d3-heatmap-table/d3-heatmap-table').then((m) => m.D3HeatmapTableComponent),
  },
];
