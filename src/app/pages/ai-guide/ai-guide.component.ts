import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { CodeBlockComponent } from '../../shared/components/code-block/code-block.component';
import mermaid from 'mermaid';
import svgPanZoom from 'svg-pan-zoom';

@Component({
  selector: 'app-ai-guide',
  standalone: true,
  imports: [CodeBlockComponent],
  templateUrl: './ai-guide.component.html',
  styleUrl: './ai-guide.component.scss',
})
export class AiGuideComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mermaidDiagram', { static: false }) mermaidRef!: ElementRef<HTMLDivElement>;
  private panZoomInstance: any = null;

  handbookDiagram = `graph TB
    %% ── AI Context Setup ──
    subgraph AI["<b>AI Context Layers</b>"]
      direction TB
      CM["<b>CLAUDE.md</b><br/><i>Auto-loaded every session</i><br/>Stack · File structure · Pointer to handbook"]
      HB["<b>d3handbook.md</b><br/><i>Deep domain context</i><br/>Models · Patterns · APIs · Conventions"]
      CM -->|"references"| HB
    end

    subgraph SK["<b>Claude Skills</b> &nbsp; <i>.claude/skills/</i>"]
      direction LR
      NC["<b>/new-chart</b><br/>Scaffold component"]
      MT["<b>/migrate-tableau</b><br/>Tableau → D3"]
      RC["<b>/review-chart</b><br/>Pattern audit"]
    end

    HB -->|"powers"| SK

    %% ── 5-Layer Data Architecture ──
    subgraph DATA["<b>5-Layer Data Architecture</b>"]
      direction TB
      L1["<b>Layer 1 — Raw/Domain</b><br/>MetricRecord · PeriodData<br/><i>From API, never mutated</i>"]
      SVC["<b>ChartTransformService</b><br/>toMultiPeriodSeries · enrichWithDelta · toPercentOfTotal"]
      L2["<b>Layer 2 — ChartConfig</b><br/>type · xKey · yKey · axes · colors · toggles<br/><i>HOW to render</i>"]
      L3["<b>Layer 3 — ChartSeries / ChartPoint</b><br/>id · label · period · points[]<br/><i>Transformed data ready for D3</i>"]
      L4["<b>Layer 4 — TooltipContext</b><br/>x · series[] · position<br/><i>Tooltip state at hovered x</i>"]
      L5["<b>Layer 5 — ChartView</b><br/>config + series + activePeriods + tooltip<br/><i>Full dashboard panel</i>"]
      L1 --> SVC --> L3
      L2 -.->|"configures"| L3
      L3 --> L4 --> L5
    end

    %% ── Chart Component Pattern ──
    subgraph COMP["<b>Chart Component Pattern</b>"]
      direction TB
      INIT["<b>ngOnInit</b><br/>draw() + observeResize()"]
      DRAW["<b>draw()</b><br/>1. Clear SVG<br/>2. Read container width<br/>3. initSvg → margin convention<br/>4. Create scales<br/>5. Render marks<br/>6. Wire interactions"]
      DEST["<b>ngOnDestroy</b><br/>cleanup resize observer"]
      INIT --> DRAW
      INIT --> DEST
    end

    %% ── Shared Helpers ──
    subgraph HELP["<b>d3.helpers.ts</b>"]
      direction LR
      H1["<b>initSvg</b><br/>margin convention<br/>→ root, g, width, height"]
      H2["<b>observeResize</b><br/>ResizeObserver + debounce<br/>→ cleanup function"]
      H3["<b>attachTooltip</b><br/>mouseover/move/leave<br/>→ TooltipState"]
      H4["<b>attachClick</b><br/>click → ChartClickEvent"]
      H5["<b>drawLegend</b><br/>style · layout · onHighlight<br/><i>Click = highlight 12% dim</i>"]
    end

    DRAW -->|"uses"| HELP
    L3 -->|"feeds"| DRAW

    %% ── Tableau Mapping ──
    subgraph TAB["<b>Tableau → D3 Mapping</b>"]
      direction LR
      T1["Columns shelf → scaleBand / scalePoint / scaleTime"]
      T2["Rows shelf → scaleLinear"]
      T3["Color shelf → scaleOrdinal + drawLegend"]
      T4["Pages shelf → multi-period ChartSeries[]"]
      T5["LOD expr → d3.rollup in service"]
      T6["Stack marks → d3.stack layout"]
    end

    HB -->|"documents"| DATA
    HB -->|"documents"| COMP
    HB -->|"documents"| HELP
    HB -->|"documents"| TAB

    %% ── Styling ──
    classDef ai fill:#eff6ff,stroke:#3b82f6,stroke-width:2px,color:#1e40af
    classDef skill fill:#ecfdf5,stroke:#10b981,stroke-width:2px,color:#065f46
    classDef data fill:#fefce8,stroke:#eab308,stroke-width:2px,color:#854d0e
    classDef comp fill:#faf5ff,stroke:#a855f7,stroke-width:2px,color:#6b21a8
    classDef helper fill:#fff1f2,stroke:#f43f5e,stroke-width:2px,color:#9f1239
    classDef tab fill:#f0fdfa,stroke:#14b8a6,stroke-width:2px,color:#115e59

    class CM,HB ai
    class NC,MT,RC skill
    class L1,SVC,L2,L3,L4,L5 data
    class INIT,DRAW,DEST comp
    class H1,H2,H3,H4,H5 helper
    class T1,T2,T3,T4,T5,T6 tab`;

  ngAfterViewInit(): void {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      themeVariables: {
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        fontSize: '13px',
      },
      flowchart: {
        htmlLabels: true,
        curve: 'basis',
        padding: 12,
      },
    });
    this.renderDiagram();
  }

  zoomLevel = 100;

  ngOnDestroy(): void {
    this.panZoomInstance?.destroy();
  }

  private async renderDiagram(): Promise<void> {
    if (!this.mermaidRef) return;
    const { svg } = await mermaid.render('handbook-diagram', this.handbookDiagram);
    this.mermaidRef.nativeElement.innerHTML = svg;

    const svgEl = this.mermaidRef.nativeElement.querySelector('svg')!;
    svgEl.setAttribute('width', '100%');
    svgEl.setAttribute('height', '100%');
    svgEl.style.cursor = 'grab';

    this.panZoomInstance?.destroy();
    this.panZoomInstance = svgPanZoom(svgEl, {
      zoomEnabled: true,
      panEnabled: true,
      controlIconsEnabled: false,
      dblClickZoomEnabled: true,
      mouseWheelZoomEnabled: true,
      preventMouseEventsDefault: true,
      zoomScaleSensitivity: 0.3,
      minZoom: 0.2,
      maxZoom: 5,
      fit: true,
      center: true,
      onZoom: (level: number) => {
        this.zoomLevel = Math.round(level * 100);
      },
    });
  }

  resetZoom(): void {
    this.panZoomInstance?.resetZoom();
    this.panZoomInstance?.resetPan();
    this.panZoomInstance?.fit();
    this.panZoomInstance?.center();
  }

  zoomIn(): void {
    this.panZoomInstance?.zoomIn();
  }

  zoomOut(): void {
    this.panZoomInstance?.zoomOut();
  }

  // ── Section 1: Folder structure ────────────────────────────────────────
  folderStructureCode = `your-project/
├── CLAUDE.md                          # Basic project context (auto-loaded)
├── d3handbook.md                      # Deep domain context (referenced in CLAUDE.md)
├── .claude/
│   ├── settings.json                  # Tool permissions
│   └── skills/
│       ├── new-chart/
│       │   └── SKILL.md               # /new-chart skill
│       ├── migrate-tableau/
│       │   ├── SKILL.md               # /migrate-tableau skill
│       │   └── mapping-reference.md   # Supporting file
│       └── review-chart/
│           └── SKILL.md               # /review-chart skill
├── src/
│   └── ...your code`;

  // ── Section 2: CLAUDE.md (short, points to handbook) ───────────────────
  claudeMdCode = `# Healthcare Dashboard — D3 Migration

Angular 18 + D3 v7 chart migration from Tableau.

## Quick Reference
- Charts: \`src/app/charts/\` — one component per chart type
- Helpers: \`src/app/core/utils/d3.helpers.ts\`
- Models: \`src/app/core/models/chart.models.ts\`

## Deep Context
Read \`d3handbook.md\` for full architecture, patterns, and conventions.
This file covers the 5-layer data model, component patterns,
helper APIs, Tableau→D3 mapping, and how to add new charts.`;

  // ── Section 3: d3handbook.md (the differentiator) ──────────────────────
  handbookExcerptCode = `# D3 Handbook — LLM Context

> This file gives AI assistants deep context about our D3 + Angular
> chart codebase. Referenced from CLAUDE.md.

## 5-Layer Data Architecture
Layer 1: Raw/Domain (MetricRecord, PeriodData)
   ↓  ChartTransformService
Layer 2: ChartConfig — HOW to render (type, axes, colors, toggles)
   ↓
Layer 3: ChartSeries / ChartPoint — data ready for D3
   ↓
Layer 4: TooltipContext / TooltipSeries — tooltip state
   ��
Layer 5: ChartView — ties config + data + UI state

## Chart Component Pattern
Every chart follows: OnInit + OnDestroy, draw() + observeResize(),
ViewChild('chart') + ViewChild('chartContainer'),
attachTooltip() + attachClick() + drawLegend(onHighlight).

## Shared Helpers API
- initSvg(el, w, h, margin) → { root, g, width, height }
- observeResize(el, cb, debounce?) → cleanup()
- attachTooltip(sel, { onUpdate }, buildRows)
- attachClick(sel, onClick)
- drawLegend(container, items, x, y, { style, layout, onHighlight })

## Conventions
- Legend = highlight (12% dim), NOT hide
- Tooltip = Angular component, NOT D3-rendered HTML
- CSS classes on D3 elements for legend targeting
- Never mutate raw data in chart components

## Tableau → D3 Mapping (full table)
## Common D3 Patterns (scales, layouts, curves, grids)
## Adding a New Chart (9-step checklist)
...`;

  // ── Section 4: SKILL.md format ─────────────────────────────────────────
  skillFormatCode = `---
name: new-chart
description: Scaffold a new D3 chart component following project patterns
argument-hint: [chart-name]
disable-model-invocation: true
---

Your instructions here (markdown)...

# Available variables:
# $ARGUMENTS    — everything after /new-chart
# $0, $1, $2    — positional args
# !\\$BACKTICK_CMD\\$  — shell output injected before Claude sees it`;

  // ── Skill: /new-chart ──────────────────────────────────────────────────
  newChartSkillCode = `---
name: new-chart
description: Scaffold a new D3 chart component following project patterns. Use when creating a new chart type.
argument-hint: [chart-name]
disable-model-invocation: true
---

Create a new D3 chart component called \`d3-$ARGUMENTS\`.

## Before you start
Read these files to understand our patterns:
- \`d3handbook.md\` — full architecture and conventions
- \`src/app/charts/d3-bar/d3-bar.component.ts\` — reference implementation
- \`src/app/core/utils/d3.helpers.ts\` — shared helpers API
- \`src/app/core/models/chart.models.ts\` — data model interfaces

## Steps
1. \`npx ng generate component charts/d3-$ARGUMENTS --standalone --skip-tests\`
2. Define data interface: \`interface FooDatum { ... }\`
3. Implement the standard component pattern:
   - \`OnInit, OnDestroy\`
   - \`@ViewChild('chart')\` + \`@ViewChild('chartContainer')\`
   - \`draw()\` method: clear → read width → scales → render
   - \`observeResize()\` in ngOnInit, cleanup in ngOnDestroy
4. Wire interactions:
   - \`attachTooltip(selection, callbacks, buildRows)\`
   - \`attachClick(selection, handler)\`
   - \`drawLegend(container, items, x, y, { onHighlight })\`
5. Add CSS classes on D3 elements for legend targeting
6. Add code snippet string properties for the guide page
7. Create HTML template: header → chart card with \`#chartContainer\` → code blocks
8. Add lazy route to \`app.routes.ts\`
9. Add nav item to \`sidebar.component.ts\``;

  // ── Skill: /migrate-tableau ────────────────────────────────────────────
  migrateSkillCode = `---
name: migrate-tableau
description: Convert a Tableau worksheet to D3. Use when migrating charts from Tableau.
disable-model-invocation: true
---

Migrate the described Tableau worksheet to our D3 + Angular codebase.

## Before you start
Read \`d3handbook.md\` — especially the "Tableau → D3 Mapping" section.

## Input
The user will describe:
- Chart type and shelf configuration (Columns, Rows, Color, Size, etc.)
- Filters, parameters, calculated fields
- Data source structure

## Mapping process
| Tableau | D3 |
|---------|-----|
| Dimension on Columns | scaleBand / scalePoint domain |
| Measure on Rows | scaleLinear domain + .nice() |
| Date on Columns | scaleTime domain |
| Color shelf | scaleOrdinal(schemeTableau10) + drawLegend(onHighlight) |
| Size shelf | scale mapped to radius/width |
| Label shelf | <text> elements at mark centroids |
| Filters | Service-layer filtering before component |
| Parameters | Angular @Input() properties |
| Reference line | svg.append('line') dashed |
| Dual axis | Two y-scales, axisLeft + axisRight |
| Pages shelf | Multi-period ChartSeries[], small multiples |
| LOD expressions | d3.rollup() in ChartTransformService |
| Stack marks | d3.stack() layout |

## Output
1. Data interface definition
2. Full component following our draw() + resize pattern
3. HTML template with code snippets
4. Route and sidebar additions`;

  // ── Skill: /review-chart ───────────────────────────────────────────────
  reviewSkillCode = `---
name: review-chart
description: Review a D3 chart component for pattern compliance and best practices
argument-hint: [component-path]
context: fork
agent: Explore
---

Review the chart component at \`$ARGUMENTS\` against our standards.

## Read first
- \`d3handbook.md\` — the source of truth for all patterns

## Checklist
- [ ] Implements OnInit + OnDestroy
- [ ] Uses draw() + observeResize() pattern
- [ ] Clears SVG before re-draw: \`d3.select(svgEl).selectAll('*').remove()\`
- [ ] Reads container width (responsive)
- [ ] Uses initSvg() for margin convention
- [ ] Tooltip via attachTooltip() or manual handlers (multi-series)
- [ ] Click via attachClick()
- [ ] Legend via drawLegend() with onHighlight (dim 12%, not hide)
- [ ] CSS classes on D3 elements for legend targeting
- [ ] No raw data mutation in the component
- [ ] Code snippet properties for guide page
- [ ] HTML template has #chartContainer on wrapper div

## Report
List any violations with file:line references and suggested fixes.`;

  // ── Section 5: settings.json ───────────────────────────────────────────
  settingsCode = `{
  "permissions": {
    "allow": [
      "Bash(npx ng generate*)",
      "Bash(npx ng build*)",
      "Bash(npx ng serve*)",
      "Bash(npm install*)"
    ]
  }
}`;

  // ── Section 6: Prompt examples ─────────────────────────────────────────
  promptExampleCode = `# Without context files — AI generates generic D3 code
> "Make me a bar chart"
# Result: boilerplate that doesn't match your patterns

# With CLAUDE.md only — AI knows the stack
> "Create a bar chart following our patterns"
# Result: closer, but may miss helper APIs and conventions

# With CLAUDE.md + d3handbook.md — AI knows everything
> "Create a horizontal grouped bar chart for Q1-Q4 revenue"
# Result: uses initSvg, attachTooltip, drawLegend(onHighlight),
#   observeResize, correct CSS classes, code snippet properties

# With skills — one command does it all
> /new-chart hbar-revenue
# Result: complete component, HTML, route, sidebar — all correct`;

  // ── Download handbook ────────────────────────────────────────────────────
  downloadHandbook(): void {
    fetch('d3handbook.md')
      .then(res => res.text())
      .then(content => {
        const blob = new Blob([content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'd3handbook.md';
        a.click();
        URL.revokeObjectURL(url);
      });
  }

  // ── Section 7: Comparison ────────────────────────────────��─────────────
  comparisonCode = `# CLAUDE.md alone (basic)
- AI knows your stack and file structure
- Still guesses at helper APIs and conventions
- You repeat the same instructions each session

# CLAUDE.md + d3handbook.md (our approach)
- CLAUDE.md = short pointer ("read d3handbook.md")
- d3handbook.md = deep domain knowledge:
  - 5-layer data model with interfaces
  - Exact component pattern (draw + resize + tooltip + legend)
  - Helper function signatures and behavior
  - Tableau→D3 mapping table
  - 9-step "add new chart" checklist
  - Convention rules (highlight not hide, Angular tooltip, etc.)
- AI produces code that matches your codebase on the first try

# CLAUDE.md + d3handbook.md + Skills (full setup)
- Everything above PLUS:
- /new-chart → scaffolds with zero explanation needed
- /migrate-tableau → structured migration workflow
- /review-chart → automated pattern compliance audit
- Team members get consistent results regardless of AI experience`;
}
