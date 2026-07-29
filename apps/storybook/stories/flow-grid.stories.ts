import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { createRef, ref } from 'lit/directives/ref.js';
import type { ColumnDef, GridTheme, FlowGrid, GridOptions } from '@flow-grid/core';
import '@flow-grid/core';
import '@flow-grid/core/define';
import { TreeModule } from '@flow-grid/core/tree';
import { SortModule } from '@flow-grid/core/sort';
import { FilterModule } from '@flow-grid/core/filter';
import { SelectionModule } from '@flow-grid/core/selection';
import { GroupSelectionModule } from '@flow-grid/core/selection/group';
import { RowRangeModule } from '@flow-grid/core/selection/row-range';
import { CellFlashModule } from '@flow-grid/core/cell-flash';
import { KeyboardModule } from '@flow-grid/core/keyboard';
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

/**
 * A desk theme, passed as a validated object rather than a stylesheet.
 *
 * Only declared tokens are accepted; a typo throws instead of being ignored.
 */
const deskTheme: GridTheme = {
  surface: '#0a0a0a',
  background: '#141414',
  headerBackground: '#1f1f1f',
  placeholderBackground: '#141414',
  text: '#e5e5e5',
  textMuted: '#8a8a8a',
  headerText: '#f0f0f0',
  border: '#2e2e2e',
  borderSubtle: '#232323',
  focus: '#60a5fa',
  selectionBackground: 'rgb(96 165 250 / 16%)',
  hoverBackground: 'rgb(255 255 255 / 4%)',
  flashUp: 'rgb(34 197 94 / 38%)',
  flashDown: 'rgb(239 68 68 / 38%)',
  flashDuration: '600ms',
};

interface Args {
  groups: number;
  instruments: number;
  rowHeight: number;
  enableScrollJacking: boolean;
  expandByDefault: boolean;
  ticksPerFrame: number;
  resortOnValueChange: boolean;
  selectionMode: 'multi' | 'single';
  checkboxColumn: boolean;
  groupSelectsChildren: boolean;
  clickToSelect: boolean;
}

/**
 * The selection module for the bond market story.
 *
 * Held outside `render` so the controls can drive it: the grid registers the
 * modules it is given once, so an instance created per render would never be
 * the one in use.
 */
const bondMarketSelection = new SelectionModule<Bond>({ mode: 'multi' });

/**
 * Hierarchy and spans are separate modules now, so the bond market installs
 * all three. Held outside `render` for the same reason as the others.
 */
const bondMarketGroupSelection = new GroupSelectionModule<Bond>();
const bondMarketRowRange = new RowRangeModule<Bond>();

/** Held outside `render` for the same reason as the selection module. */
const bondMarketSort = new SortModule<Bond>();

const meta: Meta<Args> = {
  title: 'Flow grid/Bond market',
  argTypes: {
    groups: { control: { type: 'range', min: 1, max: 50, step: 1 } },
    instruments: { control: { type: 'range', min: 10, max: 10_000, step: 10 } },
    rowHeight: { control: { type: 'range', min: 20, max: 48, step: 1 } },
    ticksPerFrame: { control: { type: 'range', min: 1, max: 100, step: 1 } },
    enableScrollJacking: { control: 'boolean' },
    expandByDefault: { control: 'boolean' },
    resortOnValueChange: {
      control: 'boolean',
      description:
        'Re-sort as prices tick. Sort by price and turn this on to see why it is off by default: rows stream past the pointer and the one you are reaching for has moved by the time you click.',
      table: { category: 'Sort' },
    },
    selectionMode: {
      control: 'inline-radio',
      options: ['multi', 'single'],
      table: { category: 'Selection' },
    },
    checkboxColumn: {
      control: 'boolean',
      description:
        'Show the leading checkbox column. Independent of the mode: single selection with checkboxes behaves like radio buttons, and the header select-all never appears in single mode.',
      table: { category: 'Selection' },
    },
    groupSelectsChildren: {
      control: 'boolean',
      description:
        'Ticking a category selects the instruments beneath it. Turn off to make a category selectable in its own right.',
      table: { category: 'Selection' },
    },
    clickToSelect: {
      control: 'boolean',
      description: 'Select by clicking anywhere in the row, not only the checkbox.',
      table: { category: 'Selection' },
    },
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
    ticksPerFrame: 50,
    resortOnValueChange: false,
    selectionMode: 'multi',
    checkboxColumn: true,
    groupSelectsChildren: true,
    clickToSelect: false,
  },
  render: (args) => {
    const gridRef = createRef<FlowGrid<Bond>>();

    // Reused across renders. Storybook re-runs render on every control change,
    // and a fresh module would never be registered — the grid keeps the modules
    // it started with — so the controls would appear to do nothing.
    bondMarketSort.setOptions({ resortOnValueChange: args.resortOnValueChange });

    const selection = bondMarketSelection;
    selection.setOptions({
      mode: args.selectionMode,
      checkboxColumn: args.checkboxColumn,
      clickToSelect: args.clickToSelect,
    });
    // Group behaviour belongs to the module that supplies it.
    bondMarketGroupSelection.setOptions({ groupSelectsChildren: args.groupSelectsChildren });
    const data = generateBonds(args.groups, args.instruments);
    let frame: number | null = null;

    const options: GridOptions<Bond> = {
      columns,
      rowHeight: args.rowHeight,
      headerHeight: args.rowHeight,
      enableScrollJacking: args.enableScrollJacking,
      theme: deskTheme,
      ariaLabel: `Bond market: ${args.instruments} instruments across ${args.groups} groups`,
      modules: [
        new TreeModule<Bond>({
          getParentId: (bond) => bond.parentId,
          defaultExpanded: args.expandByDefault ? (bond) => bond.parentId === null : false,
        }),
        bondMarketSort,
        new FilterModule<Bond>(),
        new CellFlashModule<Bond>(),
        new KeyboardModule<Bond>(),
        // Row selection is flat on its own. The group module is what makes
        // ticking a category select the instruments beneath it, respecting the
        // current filter and showing indeterminate while only some are; the
        // row-range module is what makes shift-click select a span.
        selection,
        bondMarketGroupSelection,
        bondMarketRowRange,
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
          <flow-grid
            ${ref(gridRef)}
            .gridOptions=${options}
            .rowData=${data}
            style="height: 100%"
          ></flow-grid>
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
          <flow-grid .gridOptions=${options} .rowData=${data} style="height: 100%"></flow-grid>
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
    // Instrument flexes to fill the width; the numeric columns stay pinned.
    // Omitting `width` is what makes a column flexible.
    const stackColumns = columns.map((column) => {
      if (column.field !== 'instrument') return column;
      const { width: _width, ...flexible } = column;
      return { ...flexible, minWidth: 240 };
    });
    const options: GridOptions<Bond> = {
      columns: stackColumns,
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
          <flow-grid .gridOptions=${options} .rowData=${data} style="height: 100%"></flow-grid>
        </div>
      </div>
    `;
  },
};
