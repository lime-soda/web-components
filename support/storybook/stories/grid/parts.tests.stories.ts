import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { GridOptions } from '@lime-soda/grid';
import '@lime-soda/grid';
import '@lime-soda/grid/layouts';
import { TreeModule } from '@lime-soda/grid/tree';
import { SortModule } from '@lime-soda/grid/sort';
import { SelectionModule } from '@lime-soda/grid/selection';

/**
 * Restyling the grid from page CSS, which is what `::part` is for.
 *
 * A consumer's stylesheet has to cross five shadow boundaries to reach the text
 * inside a cell, and each one only forwards what it was told to. A part that
 * stops being forwarded still renders — it simply becomes unreachable, and
 * nothing about the grid looks wrong until someone tries to style it.
 *
 * Judged by Chromatic rather than by reading computed values. Every one of
 * these is a question about how the grid looks once a consumer has had their
 * way with it, and a colour read back from `getComputedStyle` is the weaker
 * form of that question: it can confirm a value arrived without showing that
 * the result is the one anybody wanted.
 */

interface Bond {
  id: string;
  parentId: string | null;
  name: string;
  price: number;
}

const data: Bond[] = [
  { id: 'g', parentId: null, name: 'Gilts', price: 0 },
  ...Array.from({ length: 5 }, (_, i) => ({
    id: `g-${i}`,
    parentId: 'g',
    name: `UKT ${i}% 2030`,
    price: 100 + i,
  })),
];

const options: GridOptions<Bond> = {
  columns: [
    { field: 'name', headerName: 'Instrument', width: 260 },
    {
      field: 'price',
      headerName: 'Price',
      width: 120,
      valueFormatter: ({ value }) => String(value),
    },
  ],
  getRowId: (row) => row.id,
  layout: 'stack',
  rowHeight: 32,
  headerHeight: 40,
  modules: [
    new TreeModule<Bond>({ getParentId: (bond) => bond.parentId, defaultExpanded: true }),
    new SortModule<Bond>(),
    new SelectionModule<Bond>({ mode: 'multi', checkboxColumn: true }),
  ],
};

/** Renders the grid under a page stylesheet, as a consumer would write one. */
const styled = (css: string) => html`
  <style>
    ${css}
  </style>
  <div style="width:640px;height:280px;padding:12px">
    <ls-grid .gridOptions=${options} .rowData=${data} style="height:100%"></ls-grid>
  </div>
`;

const meta: Meta = {
  title: 'Grid/Tests/Parts',
  parameters: {
    layout: 'fullscreen',
    docs: { disable: true },
    a11y: { test: 'error' },
  },
};

export default meta;
type Story = StoryObj;

/**
 * Every reachable part, coloured at once.
 *
 * One image answers what seven computed-value assertions used to, and answers
 * it better: a part that stopped being forwarded disappears from the picture
 * rather than failing a comparison in isolation.
 */
export const EveryPartReachable: Story = {
  render: () =>
    styled(`
      ls-grid::part(scroller) { background: #fff7ed; }
      ls-grid::part(instance) { outline: 2px solid #ea580c; }
      ls-grid::part(header-cell) { background: #ffedd5; color: #7c2d12; }
      ls-grid::part(row) { outline: 1px dashed #fdba74; }
      ls-grid::part(cell) { background: #fffbeb; }
      ls-grid::part(cell-content) { font-style: italic; }
      ls-grid::part(tree-expander) { outline: 2px solid #16a34a; }
      ls-grid::part(sort-indicator) { outline: 2px solid #2563eb; }
      ls-grid::part(selection-checkbox) { outline: 2px solid #db2777; }
    `),
};

/**
 * The deepest reach: the text inside a cell, five boundaries from the page.
 *
 * Alone rather than among the others, because it is the one most likely to be
 * lost quietly — every boundary between it and the page has to forward it.
 */
export const InsideACell: Story = {
  render: () =>
    styled(`
      ls-grid::part(cell-content) {
        background: #dcfce7;
        outline: 2px solid #15803d;
      }
    `),
};

/** A part contributed by a module, named nowhere in core. */
export const ModuleContributedPart: Story = {
  render: () =>
    styled(`
      ls-grid::part(tree-expander) {
        background: #ede9fe;
        outline: 2px solid #6d28d9;
      }
    `),
};

/** Untouched, so a diff shows what the stylesheets above actually changed. */
export const Unstyled: Story = {
  render: () => styled(''),
};
