import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { createRef, ref } from 'lit/directives/ref.js';
import type { ColumnDef, FgGrid, GridOptions } from '@flowgrid/core';
import '@flowgrid/core';
import { TreeModule } from '@flowgrid/core/tree';
import { SortModule } from '@flowgrid/core/sort';
import { FilterModule } from '@flowgrid/core/filter';
import { SelectionModule } from '@flowgrid/core/selection';
import { CellFlashModule } from '@flowgrid/core/cell-flash';
import { KeyboardModule } from '@flowgrid/core/keyboard';
import { type Bond, generateBonds, tick } from './bond-data.js';
import './depth-bar.js';

const columns: ColumnDef<Bond>[] = [
  { field: 'instrument', headerName: 'Instrument', width: 260 },
  {
    field: 'bidDepth',
    headerName: 'Bid Depth',
    width: 90,
    cellRenderer: 'depth-bar',
    enableCellFlash: false,
  },
  {
    field: 'bidSize',
    headerName: 'Bid Size',
    width: 100,
    valueFormatter: ({ value, node }) =>
      node.data.parentId === null ? '' : (value as number).toLocaleString(),
  },
  {
    field: 'price',
    headerName: 'Price',
    width: 100,
    valueFormatter: ({ value, node }) =>
      node.data.parentId === null ? '' : (value as number).toFixed(3),
  },
  {
    field: 'askSize',
    headerName: 'Ask Size',
    width: 100,
    valueFormatter: ({ value, node }) =>
      node.data.parentId === null ? '' : (value as number).toLocaleString(),
  },
  {
    field: 'askDepth',
    headerName: 'Ask Depth',
    width: 90,
    cellRenderer: 'depth-bar',
    enableCellFlash: false,
  },
];

interface Args {
  groups: number;
  instruments: number;
  rowHeight: number;
  enableScrollJacking: boolean;
  expandByDefault: boolean;
  ticksPerFrame: number;
}

const meta: Meta<Args> = {
  title: 'Flow grid/Bond market',
  argTypes: {
    groups: { control: { type: 'range', min: 1, max: 50, step: 1 } },
    instruments: { control: { type: 'range', min: 10, max: 10_000, step: 10 } },
    rowHeight: { control: { type: 'range', min: 20, max: 48, step: 1 } },
    ticksPerFrame: { control: { type: 'range', min: 1, max: 100, step: 1 } },
    enableScrollJacking: { control: 'boolean' },
    expandByDefault: { control: 'boolean' },
  },
};

export default meta;

/**
 * The layout the package exists for: instruments grouped by category, flowing
 * left to right across the full width of the monitor. Scroll sideways — a group
 * that does not fit reappears as a heading atop the next instance.
 */
export const BondMarket: StoryObj<Args> = {
  args: {
    groups: 25,
    instruments: 5000,
    rowHeight: 28,
    enableScrollJacking: true,
    expandByDefault: true,
    ticksPerFrame: 20,
  },
  render: (args) => {
    const gridRef = createRef<FgGrid<Bond>>();
    const data = generateBonds(args.groups, args.instruments);
    let frame: number | null = null;

    const options: GridOptions<Bond> = {
      columns,
      rowHeight: args.rowHeight,
      headerHeight: args.rowHeight,
      enableScrollJacking: args.enableScrollJacking,
      ariaLabel: `Bond market: ${args.instruments} instruments across ${args.groups} groups`,
      modules: [
        new TreeModule<Bond>({
          getParentId: (bond) => bond.parentId,
          defaultExpanded: args.expandByDefault ? (bond) => bond.parentId === null : false,
        }),
        new SortModule<Bond>(),
        new FilterModule<Bond>(),
        new CellFlashModule<Bond>(),
        new KeyboardModule<Bond>(),
        new SelectionModule<Bond>({
          mode: 'multi',
          // Group headings are context, not instruments a trader can put in a basket.
          isSelectable: (_id, meta) => meta['hasChildren'] !== true,
        }),
      ],
    };

    const toggleTicking = (event: Event) => {
      const button = event.currentTarget as HTMLButtonElement;
      const grid = gridRef.value;
      if (!grid) return;

      if (frame !== null) {
        cancelAnimationFrame(frame);
        frame = null;
        button.dataset['variant'] = '';
        button.textContent = 'Start ticking';
        return;
      }

      button.dataset['variant'] = 'live';
      button.textContent = 'Stop ticking';

      const run = () => {
        grid.api.applyTransaction({ update: tick(data, args.ticksPerFrame) });
        frame = requestAnimationFrame(run);
      };
      frame = requestAnimationFrame(run);
    };

    return html`
      <div class="demo">
        <div class="demo__toolbar">
          <button @click=${toggleTicking}>Start ticking</button>
          <button @click=${() => gridRef.value?.api.expandAll()}>Expand all</button>
          <button @click=${() => gridRef.value?.api.collapseAll()}>Collapse all</button>
          <input
            type="search"
            placeholder="Quick filter…"
            aria-label="Quick filter"
            @input=${(event: Event) =>
              gridRef.value?.api.setQuickFilter((event.target as HTMLInputElement).value)}
            style="background:#262626;color:#e5e5e5;border:1px solid #404040;padding:6px 10px;border-radius:4px;font:inherit"
          />
          <button @click=${() => gridRef.value?.api.clearSort()}>Clear sort</button>
          <button @click=${() => gridRef.value?.api.selectAll()}>Select all</button>
          <button @click=${() => gridRef.value?.api.clearSelection()}>Clear selection</button>
          <span class="demo__stat">
            <strong>${args.instruments.toLocaleString()}</strong> instruments in
            <strong>${args.groups}</strong> groups
          </span>
          <span class="demo__stat">
            instances: <strong>${''}</strong>
            <span
              ${ref((el) => {
                if (!el) return;
                const update = () => {
                  const grid = gridRef.value;
                  if (grid) el.textContent = String(grid.api.getLayout().instances.length);
                  requestAnimationFrame(update);
                };
                update();
              })}
            ></span>
          </span>
        </div>
        <div class="demo__grid">
          <fg-grid
            ${ref(gridRef)}
            .gridOptions=${options}
            .rowData=${data}
            style="height: 100%"
          ></fg-grid>
        </div>
      </div>
    `;
  },
};

/**
 * Core with nothing installed. No tree module, so no hierarchy, no expander — the
 * rows flow in insertion order and the grid still works.
 */
export const CoreOnly: StoryObj<Args> = {
  args: { ...BondMarket.args! },
  render: (args) => {
    const data = generateBonds(args.groups, args.instruments).filter((b) => b.parentId !== null);
    const options: GridOptions<Bond> = {
      columns,
      rowHeight: args.rowHeight,
      headerHeight: args.rowHeight,
      enableScrollJacking: args.enableScrollJacking,
    };

    return html`
      <div class="demo">
        <div class="demo__toolbar">
          <span class="demo__stat">Core only — no modules imported</span>
        </div>
        <div class="demo__grid">
          <fg-grid .gridOptions=${options} .rowData=${data} style="height: 100%"></fg-grid>
        </div>
      </div>
    `;
  },
};

/** The same data in conventional vertical layout, for comparison. */
export const StackLayout: StoryObj<Args> = {
  args: { ...BondMarket.args! },
  render: (args) => {
    const data = generateBonds(args.groups, args.instruments);
    const options: GridOptions<Bond> = {
      columns,
      layout: 'stack',
      rowHeight: args.rowHeight,
      headerHeight: args.rowHeight,
      modules: [
        new TreeModule<Bond>({
          getParentId: (bond) => bond.parentId,
          defaultExpanded: (bond) => bond.parentId === null,
        }),
      ],
    };

    return html`
      <div class="demo">
        <div class="demo__toolbar">
          <span class="demo__stat">Vertical layout — same data, same core</span>
        </div>
        <div class="demo__grid">
          <fg-grid .gridOptions=${options} .rowData=${data} style="height: 100%"></fg-grid>
        </div>
      </div>
    `;
  },
};
