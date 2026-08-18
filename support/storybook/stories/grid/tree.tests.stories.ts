import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect, userEvent } from 'storybook/test';
import '@lime-soda/grid';
import '@lime-soda/grid/layouts';
import { TreeModule } from '@lime-soda/grid/tree';
import { dataRows, getAllByRole, gridReady, queryAllByRole } from './shadow-queries.js';
import { type Instrument, grouped, mountGrid, testStoryParameters } from './fixtures.js';

/**
 * What a hierarchy says about itself.
 *
 * A tree changes what the grid is, not merely what it looks like: rows sit
 * inside rows, so the whole thing stops being a grid and becomes a treegrid,
 * and every row has to carry its depth and whether it is open. A screen reader
 * reads that structure and nothing else.
 *
 * The repeated ancestor is here rather than in the ARIA stories because it is
 * the tree that produces one: an instance that continues a group redraws its
 * heading at the top so a reader arriving mid-group knows what they are in.
 */

const withTree = (options: { defaultExpanded?: boolean } = {}) => [
  new TreeModule<Instrument>({
    getParentId: (row) => row.parentId,
    defaultExpanded: options.defaultExpanded ?? true,
  }),
];

const meta: Meta = {
  title: 'Grid/Tests/Tree',
  parameters: testStoryParameters,
  render: () => mountGrid({ data: grouped(1, 4), height: 300, options: { modules: withTree() } }),
};

export default meta;
type Story = StoryObj;

const gridOf = (canvas: HTMLElement) => canvas.querySelector('ls-grid')!;

export const RowsInsideRowsMakeItATreegrid: Story = {
  play: async ({ canvasElement }) => {
    await gridReady(canvasElement);

    await expect(gridOf(canvasElement).getAttribute('role')).toBe('treegrid');
  },
};

export const EveryRowCarriesItsLevel: Story = {
  play: async ({ canvasElement }) => {
    await gridReady(canvasElement);
    const [group, child] = dataRows(canvasElement);

    await expect(group!.getAttribute('aria-level')).toBe('1');
    await expect(child!.getAttribute('aria-level')).toBe('2');
  },
};

export const OnlyRowsThatOpenSaySoTheyAreOpen: Story = {
  play: async ({ canvasElement }) => {
    // `aria-expanded` goes on the row, which is where a treegrid looks for it —
    // and a row with nothing beneath it must not claim to be collapsible.
    await gridReady(canvasElement);
    const [group, child] = dataRows(canvasElement);

    await expect(group!.getAttribute('aria-expanded')).toBe('true');
    await expect(child!.hasAttribute('aria-expanded')).toBe(false);
  },
};

export const CollapsingAGroupIsAnnounced: Story = {
  play: async ({ canvasElement }) => {
    // Collapsed with the expander, as a user does it.
    await gridReady(canvasElement);
    const before = dataRows(canvasElement).length;

    await userEvent.click(getAllByRole(canvasElement, 'button', { name: /Collapse|Expand/ })[0]!);

    await expect(dataRows(canvasElement)[0]!.getAttribute('aria-expanded')).toBe('false');
    await expect(dataRows(canvasElement).length).toBeLessThan(before);
  },
};

export const AContinuedGroupRedrawsItsHeadingOutOfReach: Story = {
  render: () =>
    mountGrid({
      data: grouped(1, 40),
      height: 300,
      options: { modules: withTree() },
    }),
  play: async ({ canvasElement }) => {
    // The redrawn heading is context, not a second row: hidden from the reading
    // order so the count stays honest, and inert so the copy cannot be operated
    // while the row it copies still can be.
    await gridReady(canvasElement);

    const repeats = queryAllByRole(canvasElement, 'row', { includeHidden: true }).filter(
      (row) => row.getAttribute('aria-hidden') === 'true',
    );

    // Asserted, because an empty list would pass the loop regardless.
    await expect(repeats.length).toBeGreaterThan(0);
    for (const repeat of repeats) {
      await expect((repeat as HTMLElement).inert).toBe(true);
      await expect(repeat.hasAttribute('aria-rowindex')).toBe(false);
    }
  },
};
