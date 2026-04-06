import * as d3 from 'd3';
import { ChartMargin, ChartClickEvent } from '../models';
import { TooltipState, TooltipRow, emptyTooltip } from '../../shared/components/chart-tooltip/chart-tooltip.component';

// ---------------------------------------------------------------------------
// SVG initialisation (margin convention)
// ---------------------------------------------------------------------------

export interface SvgContainer {
  root: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  g: d3.Selection<SVGGElement, unknown, null, undefined>;
  width: number;
  height: number;
}

export function initSvg(
  el: SVGSVGElement,
  totalWidth: number,
  totalHeight: number,
  margin: ChartMargin,
): SvgContainer {
  const width = totalWidth - margin.left - margin.right;
  const height = totalHeight - margin.top - margin.bottom;

  const root = d3
    .select(el)
    .attr('width', totalWidth)
    .attr('height', totalHeight);

  const g = root
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  return { root, g, width, height };
}

// ---------------------------------------------------------------------------
// Resize observer — debounced, returns cleanup function
// ---------------------------------------------------------------------------

export function observeResize(
  el: HTMLElement,
  callback: (width: number, height: number) => void,
  debounceMs = 200,
): () => void {
  let timer: ReturnType<typeof setTimeout>;
  const observer = new ResizeObserver((entries) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        callback(width, height);
      }
    }, debounceMs);
  });
  observer.observe(el);
  return () => {
    clearTimeout(timer);
    observer.disconnect();
  };
}

// ---------------------------------------------------------------------------
// Tooltip helpers
// ---------------------------------------------------------------------------

export interface TooltipCallbacks {
  onUpdate: (state: TooltipState) => void;
}

export function attachTooltip<GElement extends SVGElement, Datum>(
  selection: d3.Selection<GElement, Datum, SVGGElement | SVGSVGElement, unknown>,
  callbacks: TooltipCallbacks,
  buildRows: (d: Datum) => { title: string; rows: TooltipRow[] },
  container?: HTMLElement,
): void {
  function coords(event: MouseEvent): { x: number; y: number } {
    if (container) {
      const rect = container.getBoundingClientRect();
      return {
        x: event.clientX - rect.left + container.scrollLeft,
        y: event.clientY - rect.top + container.scrollTop,
      };
    }
    return { x: event.offsetX, y: event.offsetY };
  }

  selection
    .style('cursor', 'pointer')
    .on('mouseover', (event: MouseEvent, d: Datum) => {
      const { title, rows } = buildRows(d);
      const { x, y } = coords(event);
      callbacks.onUpdate({ visible: true, x, y, title, rows });
      d3.select(event.currentTarget as SVGElement).attr('opacity', '0.7');
    })
    .on('mousemove', (event: MouseEvent) => {
      const { x, y } = coords(event);
      callbacks.onUpdate({ visible: true, x, y, title: '', rows: [] });
    })
    .on('mouseleave', (event: MouseEvent) => {
      callbacks.onUpdate(emptyTooltip());
      d3.select(event.currentTarget as SVGElement).attr('opacity', '1');
    });
}

// ---------------------------------------------------------------------------
// Click helper
// ---------------------------------------------------------------------------

export function attachClick<GElement extends SVGElement, Datum>(
  selection: d3.Selection<GElement, Datum, SVGGElement | SVGSVGElement, unknown>,
  onClick: (event: ChartClickEvent<Datum>) => void,
): void {
  selection.on('click', (event: MouseEvent, d: Datum) => {
    onClick({ datum: d, event });
  });
}

// ---------------------------------------------------------------------------
// Legend helpers
// ---------------------------------------------------------------------------

export type LegendStyle = 'rect' | 'line';

export interface LegendItem {
  label: string;
  color: string;
}

export type LegendLayout = 'vertical' | 'horizontal';

export interface LegendOptions {
  style?: LegendStyle;
  layout?: LegendLayout;
  /** Called when a legend item is clicked. `highlighted` is the clicked label, or null when reset to show all. */
  onHighlight?: (highlighted: string | null) => void;
}

export function drawLegend<GElement extends SVGElement>(
  container: d3.Selection<GElement, unknown, null, undefined>,
  items: LegendItem[],
  x: number,
  y: number,
  styleOrOpts?: LegendStyle | LegendOptions,
  layout?: LegendLayout,
): void {
  let style: LegendStyle = 'rect';
  let legendLayout: LegendLayout = 'vertical';
  let onHighlight: ((highlighted: string | null) => void) | undefined;

  if (typeof styleOrOpts === 'object') {
    style = styleOrOpts.style ?? 'rect';
    legendLayout = styleOrOpts.layout ?? 'vertical';
    onHighlight = styleOrOpts.onHighlight;
  } else if (styleOrOpts) {
    style = styleOrOpts;
    legendLayout = layout ?? 'vertical';
  }

  let currentHighlight: string | null = null;
  const legend = container.append('g').attr('transform', `translate(${x},${y})`);
  const groups: d3.Selection<SVGGElement, unknown, null, undefined>[] = [];

  let offsetX = 0;

  items.forEach((item, i) => {
    const g = legendLayout === 'horizontal'
      ? legend.append('g').attr('transform', `translate(${offsetX}, 0)`)
      : legend.append('g').attr('transform', `translate(0, ${i * 22})`);

    groups.push(g as any);
    g.style('cursor', onHighlight ? 'pointer' : 'default');

    if (style === 'line') {
      g.append('line')
        .attr('class', 'legend-icon')
        .attr('x1', 0).attr('x2', 18)
        .attr('y1', 7).attr('y2', 7)
        .attr('stroke', item.color)
        .attr('stroke-width', 2.5);
    } else {
      g.append('rect')
        .attr('class', 'legend-icon')
        .attr('width', 14).attr('height', 14)
        .attr('rx', 3)
        .attr('fill', item.color);
    }

    const textEl = g.append('text')
      .attr('x', style === 'line' ? 22 : 20)
      .attr('y', 12)
      .attr('font-size', '12px')
      .text(item.label);

    if (onHighlight) {
      g.on('click', () => {
        // Click same item again → reset to show all
        if (currentHighlight === item.label) {
          currentHighlight = null;
        } else {
          currentHighlight = item.label;
        }

        // Update legend visual: highlighted = full, others = dimmed
        groups.forEach((grp, gi) => {
          const isActive = currentHighlight === null || items[gi].label === currentHighlight;
          grp.transition().duration(200).attr('opacity', isActive ? 1 : 0.3);
        });

        onHighlight!(currentHighlight);
      });
    }

    if (legendLayout === 'horizontal') {
      const textWidth = (textEl.node()?.getComputedTextLength() ?? item.label.length * 7);
      offsetX += (style === 'line' ? 22 : 20) + textWidth + 18;
    }
  });
}
