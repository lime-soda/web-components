import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { userEvent } from 'storybook/test';
import type { GridOptions } from '@lime-soda/grid';
import '@lime-soda/grid';
import '@lime-soda/grid/layouts';
import { TreeModule } from '@lime-soda/grid/tree';
import { SortModule } from '@lime-soda/grid/sort';
import { SelectionModule } from '@lime-soda/grid/selection';
import { expect } from 'storybook/test';
import { deepElements, getByRole, gridReady } from './shadow-queries.js';
import { type Instrument, columns, grouped, visualStoryParameters } from './fixtures.js';

/** One group of four, which exercises a heading, an indent and a hierarchy. */
const data = grouped(1, 4);

/**
 * Restyling the grid from page CSS, which is what `::part` is for.
 *
 * A consumer's stylesheet crosses five shadow boundaries to reach the text
 * inside a cell, and every one only forwards what it was told to. A part that
 * stops being forwarded still renders — it simply becomes unreachable, and
 * nothing looks wrong until someone tries to style it.
 *
 * Outlines rather than fills. Painting backgrounds through `::part` was the
 * first version of this file, and it put a light background behind text that
 * stayed light: the story meant to prove `cell-content` could be reached showed
 * no cell content at all. An outline marks the box without touching what is
 * inside it, so every part stays legible while proving it was reachable.
 *
 * Judged by Chromatic. Whether a rule arrived is a question about how the grid
 * ends up looking, and a colour read back out of `getComputedStyle` answers a
 * narrower question than the one being asked.
 */

const options: GridOptions<Instrument> = {
  columns,
  getRowId: (row) => row.id,
  layout: 'stack',
  rowHeight: 32,
  headerHeight: 40,
  modules: [
    new TreeModule<Instrument>({ getParentId: (bond) => bond.parentId, defaultExpanded: true }),
    new SortModule<Instrument>(),
    new SelectionModule<Instrument>({ mode: 'multi', checkboxColumn: true }),
  ],
};

/** Renders the grid under a page stylesheet, as a consumer would write one. */
const styled = (css: string) => html`
  <style>
    ${css}
  </style>
  <div style="width:420px;height:236px">
    <ls-grid .gridOptions=${options} .rowData=${data} style="height:100%"></ls-grid>
  </div>
`;

const meta: Meta = {
  title: 'Grid/Tests/Parts',
  parameters: visualStoryParameters,
  // Pinned, because the grid's own colours resolve through `light-dark()` and a
  // baseline taken in one scheme is a failure in the other.
  globals: { theme: 'light' },
};

export default meta;
type Story = StoryObj;

/** Untouched, so a diff shows exactly what each stylesheet below changed. */
export const Unstyled: Story = {
  render: () => styled(''),
};

/**
 * The structural parts: the scroller, an instance, a row, a cell.
 *
 * Each is a box a consumer might want to draw a rule around, and each sits one
 * boundary further from the page than the last.
 */
export const StructuralParts: Story = {
  render: () =>
    styled(`
      ls-grid::part(scroller) { outline: 3px solid #0ea5e9; outline-offset: -3px; }
      ls-grid::part(instance) { outline: 2px solid #ea580c; }
      ls-grid::part(row) { outline: 1px dashed #a855f7; }
      ls-grid::part(cell) { outline: 1px dotted #16a34a; }
    `),
};

/**
 * The text inside a cell, five boundaries from the page.
 *
 * The deepest reach and the likeliest to be lost quietly, since every boundary
 * between it and the page has to forward it. Styled with weight and colour so
 * the words themselves visibly change rather than the box around them.
 */
export const InsideACell: Story = {
  render: () =>
    styled(`
      ls-grid::part(cell-content) {
        color: #be123c;
        font-weight: 700;
        font-style: italic;
      }
    `),
};

/** The header, and the label within it. */
export const HeaderParts: Story = {
  render: () =>
    styled(`
      ls-grid::part(header-cell) { outline: 2px solid #7c3aed; outline-offset: -2px; }
      ls-grid::part(header-label) { color: #be123c; text-decoration: underline; }
    `),
};

/**
 * Parts contributed by modules, named nowhere in core.
 *
 * These reach page CSS only through the module's own `parts` declaration, and
 * the sort indicator only exists once something is sorted — so this story sorts
 * a column first rather than colouring an element that is not there.
 */
export const ModuleParts: Story = {
  render: () =>
    styled(`
      ls-grid::part(tree-expander) { outline: 2px solid #6d28d9; }
      ls-grid::part(selection-checkbox) { outline: 2px solid #db2777; outline-offset: 2px; }
      ls-grid::part(sort-indicator) { outline: 2px solid #2563eb; color: #2563eb; }
    `),
  play: async ({ canvasElement }) => {
    await gridReady(canvasElement);
    // Sorted the way a user sorts: the heading's own control, which is what
    // takes the click. The header cell around it is not the button, and
    // clicking that sorted nothing at all.
    await userEvent.click(getByRole(canvasElement, 'button', { name: 'Price' }));

    // The premise, stated out loud. Without it this story photographs a grid
    // that has no sort indicator in it and reports nothing wrong, which is how
    // a picture of a missing thing passes for a picture of a present one.
    const parts = [...deepElements(canvasElement)].map((el) => el.getAttribute('part'));
    await expect(parts).toContain('sort-indicator');
  },
};
