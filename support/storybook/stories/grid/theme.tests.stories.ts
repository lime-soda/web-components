import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { userEvent } from 'storybook/test';
import type { Grid, GridOptions, GridTheme } from '@lime-soda/grid';
import '@lime-soda/grid';
import '@lime-soda/grid/layouts';
import { TreeModule } from '@lime-soda/grid/tree';
import { SortModule } from '@lime-soda/grid/sort';
import { SelectionModule } from '@lime-soda/grid/selection';
import { getAllByRole, gridReady } from './shadow-queries.js';

/**
 * Theme tokens reaching everything they have to reach.
 *
 * A token set on the grid has to arrive through every shadow root beneath it —
 * into a cell, into a header, and into markup a module rendered and styled from
 * its own adopted stylesheet. Any of those can stop working while the others
 * carry on, so each is its own picture.
 *
 * Two things these get wrong if written carelessly, and did.
 *
 * The colour scheme has to be pinned. The design system resolves its defaults
 * through `light-dark()`, so a story that does not say which it wants renders
 * against whatever the viewer has — and a baseline captured in one is a
 * failure in the other. Every story here declares it, and the ones that matter
 * declare both.
 *
 * A theme also has to be coherent. Setting text and background but not the
 * borders leaves the grid drawing dark-mode borders across light backgrounds:
 * it looks broken, and it makes the picture useless for spotting the day one of
 * those tokens genuinely stops arriving.
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

/** A complete theme, so nothing is left half-styled. */
const forest: GridTheme = {
  background: '#f7fee7',
  headerBackground: '#ecfccb',
  surface: '#f7fee7',
  text: '#14532d',
  textMuted: '#3f6212',
  headerText: '#365314',
  border: '#65a30d',
  borderSubtle: '#d9f99d',
  selectionBackground: '#fef08a',
  hoverBackground: '#ecfccb',
  accent: '#4d7c0f',
  focus: '#1d4ed8',
};

const midnight: GridTheme = {
  background: '#0b1020',
  headerBackground: '#131a33',
  surface: '#0b1020',
  text: '#dbeafe',
  textMuted: '#93c5fd',
  headerText: '#bfdbfe',
  border: '#3b82f6',
  borderSubtle: '#1e3a8a',
  selectionBackground: '#1e40af',
  hoverBackground: '#172554',
  accent: '#60a5fa',
  focus: '#f59e0b',
};

const gridWith = (theme: GridTheme, extra: Partial<GridOptions<Bond>> = {}) => {
  const options: GridOptions<Bond> = {
    columns: [
      { field: 'name', headerName: 'Instrument', width: 240 },
      { field: 'price', headerName: 'Price', width: 110 },
    ],
    getRowId: (row) => row.id,
    layout: 'stack',
    rowHeight: 32,
    headerHeight: 40,
    theme,
    modules: [
      new TreeModule<Bond>({ getParentId: (bond) => bond.parentId, defaultExpanded: true }),
      new SortModule<Bond>(),
      new SelectionModule<Bond>({ mode: 'multi', checkboxColumn: true }),
    ],
    ...extra,
  };
  // Sized to the content: a snapshot that is mostly empty canvas hides the
  // change it exists to show.
  return html`
    <div style="width:420px;height:236px">
      <ls-grid .gridOptions=${options} .rowData=${data} style="height:100%"></ls-grid>
    </div>
  `;
};

const meta: Meta = {
  title: 'Grid/Tests/Theming',
  parameters: {
    layout: 'centered',
    docs: { disable: true },
    a11y: { test: 'error' },
  },
};

export default meta;
type Story = StoryObj;

// --- the defaults, in both schemes -----------------------------------------

/** Untouched, light. The baseline every themed story is a departure from. */
export const DefaultLight: Story = {
  globals: { theme: 'light' },
  render: () => gridWith({}),
};

/**
 * Untouched, dark.
 *
 * Not a duplicate: the defaults resolve through `light-dark()`, so this is a
 * different set of colours reaching the same places, and it is where an
 * unthemed border or a hard-coded literal shows up.
 */
export const DefaultDark: Story = {
  globals: { theme: 'dark' },
  render: () => gridWith({}),
};

// --- a theme reaching every layer ------------------------------------------

/**
 * One coherent theme, arriving everywhere.
 *
 * Text reaches a cell four boundaries down, the header answers its own token,
 * the tree expander is styled from the module's adopted stylesheet and still
 * takes the grid's colour, and the borders belong to the same palette as the
 * surfaces they divide.
 */
export const ThemedLight: Story = {
  globals: { theme: 'light' },
  render: () => gridWith(forest),
};

/**
 * The same reach, over a dark scheme.
 *
 * A theme is meant to override the defaults rather than blend with them, so
 * this should look like the light one recoloured — not like a light grid with
 * dark leftovers around its edges.
 */
export const ThemedDark: Story = {
  globals: { theme: 'dark' },
  render: () => gridWith(midnight),
};

// --- individual tokens ------------------------------------------------------

/** Indent is a token, so a deep tree can be tightened without touching the grid. */
export const TreeIndentIsThemed: Story = {
  globals: { theme: 'light' },
  render: () => gridWith({ ...forest, treeIndent: '48px' }),
};

/** The highlight a trader sees on the rows they picked. */
export const SelectionHighlightIsThemed: Story = {
  globals: { theme: 'light' },
  render: () => gridWith({ ...forest, selectionBackground: '#fca5a5' }),
  play: async ({ canvasElement }) => {
    // Selected the way a user selects: ticking an instrument's checkbox.
    await gridReady(canvasElement);
    await userEvent.click(getAllByRole(canvasElement, 'checkbox', { name: 'Select' })[1]!);
  },
};

/**
 * A partial theme is valid: what is left unset keeps the component default.
 *
 * Beside `ThemedLight` this is what shows the defaults survive rather than
 * every token needing a value — and it is deliberately a token that cannot
 * clash, since a half-set palette is the fault this file used to have.
 */
export const PartialThemeKeepsTheDefaults: Story = {
  globals: { theme: 'light' },
  render: () => gridWith({ treeIndent: '48px' }),
};

/**
 * Row height belongs to the layout engine, not the theme.
 *
 * The engine decides how many rows fit an instance from `rowHeight`. A token
 * overriding that would lay rows out at a height it never planned for and every
 * instance would overflow, so the token is ignored and the rows stay 32px.
 */
export const RowHeightIgnoresTheTheme: Story = {
  globals: { theme: 'light' },
  render: () => gridWith({ ...forest, rowHeight: '999px' }, { rowHeight: 32 }),
};

/** Swapping the theme repaints what is already on screen. */
export const ThemeCanBeReplacedLive: Story = {
  globals: { theme: 'light' },
  render: () => gridWith(forest),
  play: async ({ canvasElement }) => {
    await gridReady(canvasElement);
    const grid = canvasElement.querySelector('ls-grid') as Grid<Bond>;
    // The same property a consumer sets, not a way into the grid's insides.
    grid.gridOptions = { ...grid.gridOptions!, theme: midnight };
    await grid.updateComplete;
  },
};
