import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { createRef, ref } from 'lit/directives/ref.js';
import type { Grid, GridOptions, GridTheme } from '@lime-soda/grid';
import '@lime-soda/grid';
import '@lime-soda/grid/layouts';
import { TreeModule } from '@lime-soda/grid/tree';
import { SelectionModule } from '@lime-soda/grid/selection';
import { userEvent } from 'storybook/test';
import { findAllByRole, getAllByRole } from './shadow-queries.js';

/**
 * Theme tokens reaching everything they have to reach.
 *
 * A token set on the grid has to arrive through every shadow root beneath it —
 * into a cell, into a header, and into markup a module rendered and styled from
 * its own adopted stylesheet. Any of those can stop working on its own while
 * the others carry on, which is why each is a picture rather than one.
 *
 * Judged by Chromatic. These used to read a colour back out of
 * `getComputedStyle`, which confirms an rgb value arrived somewhere without
 * showing what the grid ended up looking like — and looking right is the whole
 * requirement for a theme.
 */

interface Bond {
  id: string;
  parentId: string | null;
  name: string;
  price: number;
}

const data: Bond[] = [
  { id: 'g', parentId: null, name: 'Gilts', price: 0 },
  ...Array.from({ length: 4 }, (_, i) => ({
    id: `g-${i}`,
    parentId: 'g',
    name: `UKT ${i}% 2030`,
    price: 100 + i,
  })),
];

const gridWith = (theme: GridTheme, extra: Partial<GridOptions<Bond>> = {}) => {
  const options: GridOptions<Bond> = {
    columns: [
      { field: 'name', headerName: 'Instrument', width: 260 },
      { field: 'price', headerName: 'Price', width: 120 },
    ],
    getRowId: (row) => row.id,
    layout: 'stack',
    rowHeight: 32,
    headerHeight: 40,
    theme,
    modules: [
      new TreeModule<Bond>({ getParentId: (bond) => bond.parentId, defaultExpanded: true }),
      new SelectionModule<Bond>({ mode: 'multi', checkboxColumn: true }),
    ],
    ...extra,
  };
  return html`
    <div style="width:620px;height:260px;padding:12px">
      <ls-grid .gridOptions=${options} .rowData=${data} style="height:100%"></ls-grid>
    </div>
  `;
};

const meta: Meta = {
  title: 'Grid/Tests/Theming',
  parameters: {
    layout: 'fullscreen',
    docs: { disable: true },
    a11y: { test: 'error' },
  },
};

export default meta;
type Story = StoryObj;

/** Nothing themed, as the baseline every other story here is a change from. */
export const Default: Story = {
  render: () => gridWith({}),
};

/**
 * One token, arriving everywhere it should.
 *
 * Text reaches a cell four boundaries down; the header answers to its own
 * token; and the tree expander is styled from the module's adopted stylesheet
 * yet still takes the grid's colour.
 */
export const TokensReachEveryLayer: Story = {
  render: () =>
    gridWith({
      text: 'rgb(21, 128, 61)',
      headerText: 'rgb(153, 27, 27)',
      textMuted: 'rgb(29, 78, 216)',
      background: 'rgb(247, 254, 231)',
      headerBackground: 'rgb(254, 249, 195)',
    }),
};

/** Indent is a token, so a deep tree can be tightened without touching the grid. */
export const TreeIndentIsThemed: Story = {
  render: () => gridWith({ treeIndent: '40px' }),
};

/** The highlight a trader sees on the rows they picked. */
export const SelectionHighlightIsThemed: Story = {
  render: () => gridWith({ selectionBackground: 'rgb(254, 202, 202)' }),
  play: async ({ canvasElement }) => {
    // Selected the way a user selects: ticking an instrument's checkbox.
    await findAllByRole(canvasElement, 'gridcell');
    await userEvent.click(getAllByRole(canvasElement, 'checkbox', { name: 'Select' })[1]!);
  },
};

/**
 * A partial theme is valid: whatever is left unset keeps the component default.
 *
 * Beside the fully themed story, this is what shows the defaults still exist
 * rather than every token needing a value.
 */
export const PartialThemeKeepsTheDefaults: Story = {
  render: () => gridWith({ text: 'rgb(21, 128, 61)' }),
};

/**
 * Row height belongs to the layout engine, not the theme.
 *
 * The engine decides how many rows fit an instance from `rowHeight`. A theme
 * token overriding that would lay rows out at a height the engine never planned
 * for, and every instance would overflow — so the token is ignored and the rows
 * stay 32px in the picture.
 */
export const RowHeightIgnoresTheTheme: Story = {
  render: () => gridWith({ rowHeight: '999px' }, { rowHeight: 32 }),
};

/** Swapping the theme repaints what is already on screen. */
export const ThemeCanBeReplacedLive: Story = {
  render: () => {
    const gridRef = createRef<Grid<Bond>>();
    const options: GridOptions<Bond> = {
      columns: [
        { field: 'name', headerName: 'Instrument', width: 260 },
        { field: 'price', headerName: 'Price', width: 120 },
      ],
      getRowId: (row) => row.id,
      layout: 'stack',
      rowHeight: 32,
      headerHeight: 40,
      theme: { text: 'rgb(21, 128, 61)' },
      modules: [],
    };
    return html`
      <div style="width:620px;height:260px;padding:12px">
        <ls-grid
          ${ref(gridRef)}
          .gridOptions=${options}
          .rowData=${data}
          style="height:100%"
          data-grid
        ></ls-grid>
      </div>
    `;
  },
  play: async ({ canvasElement }) => {
    await findAllByRole(canvasElement, 'gridcell');
    const grid = canvasElement.querySelector('ls-grid') as Grid<Bond>;
    // Replacing the theme is something the application does, not the test
    // reaching inside: it is the same property a consumer sets.
    grid.gridOptions = { ...grid.gridOptions!, theme: { text: 'rgb(190, 24, 93)' } };
    await grid.updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 100));
  },
};
