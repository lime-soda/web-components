import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { createRef, ref } from 'lit/directives/ref.js';
import type { ColumnDef, GridTheme, Grid, GridOptions } from '@lime-soda/grid';
import '@lime-soda/grid';
import '@lime-soda/grid/layouts';
import { TreeModule } from '@lime-soda/grid/tree';
import { SortModule } from '@lime-soda/grid/sort';
import { FilterModule } from '@lime-soda/grid/filter';
import { SelectionModule } from '@lime-soda/grid/selection';
import { TreeSelectionModule } from '@lime-soda/grid/selection/tree';
import { RowRangeModule } from '@lime-soda/grid/selection/row-range';
import { CellFlashModule } from '@lime-soda/grid/cell-flash';
import { KeyboardModule } from '@lime-soda/grid/keyboard';
import { ColumnsModule } from '@lime-soda/grid/columns';
import '@lime-soda/button';
import type { Button } from '@lime-soda/button';
import { type Bond, generateBonds, tick } from './bond-data.js';
import './depth-bar.js';
import './demo.css';

/**
 * A category row carries no quote of its own, so its numeric cells are empty.
 *
 * Returned as undefined rather than formatted to an empty string: a missing
 * value is already blank, and saying so here leaves the column's value type to
 * decide how the numbers that do exist should read.
 */
const quoted = (field: 'bidSize' | 'price' | 'askSize') => (params: { data: Bond }) =>
  params.data.parentId === null ? undefined : params.data[field];

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
    // Right-aligned with its separators, both from the value type.
    field: 'bidSize',
    headerName: 'Bid Size',
    width: 100,
    valueType: 'number',
    valueGetter: quoted('bidSize'),
  },
  {
    // The type aligns it; the formatter overrides how it reads, because three
    // decimal places is a thing this column cares about and a locale default
    // cannot know.
    field: 'price',
    headerName: 'Price',
    width: 100,
    valueType: 'number',
    valueGetter: quoted('price'),
    valueFormatter: ({ value }) => (value === undefined ? '' : (value as number).toFixed(3)),
  },
  {
    field: 'askSize',
    headerName: 'Ask Size',
    width: 100,
    valueType: 'number',
    valueGetter: quoted('askSize'),
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
 * A desk override, passed as a validated object rather than a stylesheet.
 *
 * Deliberately small: the colours come from the design system now, so what is
 * worth showing here is the shape of the API — only declared tokens are
 * accepted, and a typo throws instead of being ignored — not a second palette
 * competing with the first.
 */
const deskTheme: GridTheme = {
  // A desk that wants every last row, below even the dense default.
  rowHeight: '22px',
  // Long enough to catch out of the corner of an eye on a busy book.
  flashDuration: '700ms',
};

interface Args {
  layout: 'flow' | 'stack';
  groups: number;
  instruments: number;
  rowHeight: number;
  enableScrollJacking: boolean;
  expandByDefault: boolean;
  ticksPerFrame: number;
  resortOnValueChange: boolean;
  skipParentRows: boolean;
  selectionMode: 'multi' | 'single';
  checkboxColumn: boolean;
  treeSelectionScope: 'self' | 'children' | 'filteredChildren';
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
const bondMarketTreeSelection = new TreeSelectionModule<Bond>({
  // `children` has to reach instruments the filter has hidden, and those are
  // not in the projection at all — so the hierarchy comes from the data.
  getParentId: (bond) => bond.parentId,
});
const bondMarketRowRange = new RowRangeModule<Bond>();

/** Held outside `render` for the same reason as the selection module. */
const bondMarketSort = new SortModule<Bond>();

/**
 * Hoisted for the same reason as the others, and with a wrinkle: `defaultExpanded`
 * seeds expansion at init and says nothing afterwards, so the control applies it
 * by expanding or collapsing when it changes rather than by rebuilding the module.
 */
const bondMarketTree = new TreeModule<Bond>({
  getParentId: (bond) => bond.parentId,
  defaultExpanded: (bond) => bond.parentId === null,
});
let lastExpandByDefault: boolean | undefined;
const bondMarketKeyboard = new KeyboardModule<Bond>();

/**
 * Held outside render like the others: Storybook re-runs render on every
 * control change, and the grid keeps the modules it started with.
 */
const arrangeableColumns = new ColumnsModule<Bond>({ minWidth: 60 });

/**
 * The one story with controls.
 *
 * Everything else under `Grid/Tests` exists to be run and asserts against a
 * fixture it fixes; this exists to be played with. Every module is installed
 * and every option that changes what the grid does is a control, including the
 * layout — so the vertical arrangement is a switch here rather than a second
 * story that drifts from the first.
 *
 * The data is a bond market because the grid is built for trading desks and a
 * demo should look like the thing it is for. The story is named for the grid.
 */
const meta: Meta<Args> = {
  title: 'Grid/Demo',
  // The grid fills its container, and the point of the flow layout is a wide
  // one: padded, centred docs canvas would show a single instance.
  parameters: {
    layout: 'fullscreen',
    controls: { expanded: true },
    // A continuation repeats the header and the ancestor rows above its own.
    // The headers are real and operable, since focus goes to each instance's
    // own; the ancestor copies are inert and skipped, since the rows they
    // copy are reachable where they actually live.
    a11y: { test: 'error' },
  },
  argTypes: {
    layout: {
      control: { type: 'inline-radio' },
      options: ['flow', 'stack'],
      description: 'Rows flowing into columns across the width, or one long list.',
      table: { category: 'Layout' },
    },
    groups: {
      control: { type: 'range', min: 1, max: 50, step: 1 },
      table: { category: 'Data' },
    },
    instruments: {
      control: { type: 'range', min: 10, max: 10_000, step: 10 },
      table: { category: 'Data' },
    },
    rowHeight: {
      control: { type: 'range', min: 20, max: 48, step: 1 },
      table: { category: 'Layout' },
    },
    ticksPerFrame: {
      control: { type: 'range', min: 1, max: 100, step: 1 },
      description: 'Rows updated per frame once ticking starts.',
      table: { category: 'Data' },
    },
    enableScrollJacking: {
      control: 'boolean',
      description: 'Turn vertical wheel movement into horizontal scrolling.',
      table: { category: 'Layout' },
    },
    expandByDefault: {
      control: 'boolean',
      description: 'Expand every category, or collapse them all.',
      table: { category: 'Tree' },
    },
    skipParentRows: {
      control: 'boolean',
      description:
        "Arrow past category headings instead of landing on them. The predicate is the story's, not the module's — it reads meta.hasChildren, a convention the tree module owns.",
      table: { category: 'Keyboard' },
    },
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
    treeSelectionScope: {
      control: 'inline-radio',
      options: ['self', 'children', 'filteredChildren'],
      description:
        'What ticking a category means: itself alone, every instrument beneath it, or only those the quick filter left visible. Type in the filter first — the last two are identical without one.',
      table: { category: 'Selection' },
    },
    clickToSelect: {
      control: 'boolean',
      description:
        'Whether a plain click anywhere in the row selects it. Off leaves the plain click free to mean something else in the application — it does not make selection unreachable, because Ctrl-click (Cmd on macOS) selects either way. Turn the checkboxes off and leave this off to see that.',
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
export const Demo: StoryObj<Args> = {
  args: {
    groups: 25,
    instruments: 5000,
    rowHeight: 28,
    enableScrollJacking: true,
    expandByDefault: true,
    ticksPerFrame: 50,
    resortOnValueChange: false,
    skipParentRows: false,
    selectionMode: 'multi',
    checkboxColumn: true,
    treeSelectionScope: 'filteredChildren',
    clickToSelect: false,
  },
  render: (args) => {
    const gridRef = createRef<Grid<Bond>>();
    // The instance counter polls on a frame loop. Held here so the loop can be
    // cancelled when the story is torn down: left running, it kept reading
    // `.api` off a detached grid, which throws once the options are gone.
    let counterFrame = 0;

    // Reused across renders. Storybook re-runs render on every control change,
    // and a fresh module would never be registered — the grid keeps the modules
    // it started with — so the controls would appear to do nothing.
    // Two halves, because expansion is seeded once and then is state.
    // `defaultExpanded` is read when the module initialises, which happens after
    // this render — so the first mount needs the option set...
    bondMarketTree.setOptions({
      defaultExpanded: args.expandByDefault ? (bond: Bond) => bond.parentId === null : false,
    });
    // ...and every later change needs saying out loud, since nothing re-reads it.
    // Only on change, so it does not fight rows the reader expanded by hand.
    if (lastExpandByDefault !== args.expandByDefault) {
      lastExpandByDefault = args.expandByDefault;
      if (args.expandByDefault) bondMarketTree.expandAll();
      else bondMarketTree.collapseAll();
    }

    bondMarketSort.setOptions({ resortOnValueChange: args.resortOnValueChange });
    // The predicate is the application's: the module has no idea what a parent row is.
    bondMarketKeyboard.setOptions({
      skipRow: args.skipParentRows ? ({ meta }) => meta['hasChildren'] === true : undefined,
    });

    const selection = bondMarketSelection;
    selection.setOptions({
      mode: args.selectionMode,
      checkboxColumn: args.checkboxColumn,
      clickToSelect: args.clickToSelect,
    });
    // Group behaviour belongs to the module that supplies it.
    bondMarketTreeSelection.setOptions({ scope: args.treeSelectionScope });
    const data = generateBonds(args.groups, args.instruments);
    let frame: number | null = null;

    const options: GridOptions<Bond> = {
      columns,
      layout: args.layout,
      rowHeight: args.rowHeight,
      headerHeight: args.rowHeight,
      enableScrollJacking: args.enableScrollJacking,
      theme: deskTheme,
      ariaLabel: `Bond market: ${args.instruments} instruments across ${args.groups} groups`,
      modules: [
        bondMarketTree,
        bondMarketSort,
        new FilterModule<Bond>(),
        new CellFlashModule<Bond>(),
        bondMarketKeyboard,
        // Row selection is flat on its own. The tree selection module is what makes
        // ticking a category select the instruments beneath it, respecting the
        // current filter and showing indeterminate while only some are; the
        // row-range module is what makes shift-click select a span.
        selection,
        bondMarketTreeSelection,
        bondMarketRowRange,
        // Drag a heading's grip to move a column, or its trailing edge to
        // resize. Pinning is stack-only, so it does nothing in the flow layout.
        arrangeableColumns,
      ],
    };

    const toggleTicking = (event: Event) => {
      const button = event.currentTarget as Button;
      const grid = gridRef.value;
      if (!grid) return;

      if (frame !== null) {
        cancelAnimationFrame(frame);
        frame = null;
        button.variant = 'outline';
        button.textContent = 'Start ticking';
        return;
      }

      // The one button that reports state rather than just doing something, so
      // it takes the accent while it is running.
      button.variant = 'primary';
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
          <ls-button size="sm" variant="outline" @click=${toggleTicking}> Start ticking </ls-button>
          <ls-button size="sm" variant="outline" @click=${() => gridRef.value?.api.expandAll()}>
            Expand all
          </ls-button>
          <ls-button size="sm" variant="outline" @click=${() => gridRef.value?.api.collapseAll()}>
            Collapse all
          </ls-button>
          <input
            type="search"
            placeholder="Quick filter…"
            aria-label="Quick filter"
            @input=${(event: Event) =>
              gridRef.value?.api.setQuickFilter((event.target as HTMLInputElement).value)}
          />
          <ls-button size="sm" variant="outline" @click=${() => gridRef.value?.api.clearSort()}>
            Clear sort
          </ls-button>
          <ls-button size="sm" variant="outline" @click=${() => gridRef.value?.api.selectAll()}>
            Select all
          </ls-button>
          <ls-button
            size="sm"
            variant="outline"
            @click=${() => gridRef.value?.api.clearSelection()}
          >
            Clear selection
          </ls-button>
          <span class="demo__stat">
            <strong>${args.instruments.toLocaleString()}</strong> instruments in
            <strong>${args.groups}</strong> groups
          </span>
          <span class="demo__stat">
            instances: <strong>${''}</strong>
            <span
              ${ref((el) => {
                cancelAnimationFrame(counterFrame);
                if (!el) return;
                const update = () => {
                  const grid = gridRef.value;
                  // `.api` throws until `gridOptions` is set, and the story can
                  // be pulled out from under the loop between frames.
                  if (grid?.isConnected && grid.gridOptions) {
                    el.textContent = String(grid.api.getLayout().instances.length);
                  }
                  counterFrame = requestAnimationFrame(update);
                };
                counterFrame = requestAnimationFrame(update);
              })}
            ></span>
          </span>
        </div>
        <div class="demo__grid">
          <ls-grid
            ${ref(gridRef)}
            .gridOptions=${options}
            .rowData=${data}
            style="height: 100%"
          ></ls-grid>
        </div>
      </div>
    `;
  },
};
