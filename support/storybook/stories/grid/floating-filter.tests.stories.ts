import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect, userEvent } from 'storybook/test';
import '@lime-soda/grid';
import '@lime-soda/grid/layouts';
import { FilterModule } from '@lime-soda/grid/filter';
import {
  cellText,
  cellsOf,
  dataRows,
  getAllByRole,
  getByRole,
  gridReady,
  queryAllByRole,
  typeInto,
} from './shadow-queries.js';
import {
  HEADER_HEIGHT,
  type Instrument,
  ROW_HEIGHT,
  instruments,
  mountGrid,
  testStoryParameters,
} from './fixtures.js';

/**
 * A strip of filter boxes beneath the column headings.
 *
 * The answer to the problem the in-header option has: a trading grid's columns
 * are 80-100px, and a box sharing that line with the label crushes the label to
 * an initial. Given a strip of its own, a box fits any column.
 *
 * What is worth testing here is mostly not the filtering — that is the filter
 * module's own, and covered without a browser. It is that a band exists at all
 * without disturbing what is around it: the headings keep their height, the
 * rows below are laid out knowing the band is there, and a box in the strip is
 * reachable and announced.
 */

const withFloating = (options: ConstructorParameters<typeof FilterModule>[0] = {}) =>
  mountGrid({
    data: instruments(40),
    width: 700,
    height: 360,
    options: {
      modules: [new FilterModule<Instrument>({ floatingFilter: true, ...options })],
    },
  });

const meta: Meta = {
  title: 'Grid/Tests/Floating filter',
  parameters: testStoryParameters,
  render: () => withFloating(),
};

export default meta;
type Story = StoryObj;

const grid = (canvas: HTMLElement) => canvas.querySelector('ls-grid')!;

const firstInstance = (canvas: HTMLElement) =>
  grid(canvas).shadowRoot!.querySelector('ls-grid-instance')!;

const band = (canvas: HTMLElement) =>
  firstInstance(canvas).shadowRoot!.querySelector('.header-band') as HTMLElement | null;

const boxes = (canvas: HTMLElement) => getAllByRole(canvas, 'searchbox');

/**
 * A box in the first instance, by the column it filters.
 *
 * Scoped to one instance because the flow layout repeats the header in every
 * one of them — deliberately, so a trader reading the fourth instance across
 * still knows what each column means — and the band goes with it. So a
 * grid-wide query for "Filter Price" finds one per instance, all driving the
 * same model.
 */
const boxFor = (canvas: HTMLElement, column: string) =>
  getByRole(firstInstance(canvas), 'searchbox', { name: `Filter ${column}` }) as HTMLInputElement;

// --- the band exists --------------------------------------------------------

export const EveryColumnGetsABox: Story = {
  play: async ({ canvasElement }) => {
    await gridReady(canvasElement);

    await expect(boxes(canvasElement).length).toBeGreaterThanOrEqual(3);
  },
};

export const NoBandWithoutTheOption: Story = {
  render: () => mountGrid({ data: instruments(40), modules: [] } as never),
  play: async ({ canvasElement }) => {
    // A strip costs a row's worth of vertical space on a surface whose currency
    // is rows on screen, so it is opt-in.
    await gridReady(canvasElement);

    await expect(band(canvasElement)).toBeNull();
    await expect(queryAllByRole(canvasElement, 'searchbox')).toHaveLength(0);
  },
};

export const ABoxSaysWhichColumnItFilters: Story = {
  play: async ({ canvasElement }) => {
    // Three boxes in a row are indistinguishable without it.
    await gridReady(canvasElement);

    await expect(boxFor(canvasElement, 'Price')).toBeTruthy();
  },
};

// --- it does not disturb what is around it ----------------------------------

export const TheHeadingsKeepTheirHeight: Story = {
  play: async ({ canvasElement }) => {
    // The band is charged to the header's total so the layout can size around
    // it. If that same number also reached the heading row, the headings would
    // pay for the band as well and grow by its height.
    await gridReady(canvasElement);
    const heading = getAllByRole(canvasElement, 'columnheader')[0]!;

    await expect(Math.round(heading.getBoundingClientRect().height)).toBe(HEADER_HEIGHT);
  },
};

export const TheBandSitsBetweenTheHeadingsAndTheRows: Story = {
  play: async ({ canvasElement }) => {
    await gridReady(canvasElement);
    const heading = getAllByRole(canvasElement, 'columnheader')[0]!.getBoundingClientRect();
    const strip = band(canvasElement)!.getBoundingClientRect();
    const firstRow = cellsOf(dataRows(canvasElement)[0]!)[0]!.getBoundingClientRect();

    await expect(strip.top).toBeGreaterThanOrEqual(heading.bottom - 1);
    await expect(firstRow.top).toBeGreaterThanOrEqual(strip.bottom - 1);
  },
};

/** How many rows the first instance drew. */
const rowCount = (canvas: HTMLElement) =>
  firstInstance(canvas).shadowRoot!.querySelectorAll('ls-grid-row').length;

export const TheBandCostsTheRowsItsHeight: Story = {
  play: async ({ canvasElement }) => {
    // The engine fits rows into the viewport height less the header, so a band
    // it was never told about would push the last row of every instance out of
    // view. Asserted as a count rather than as "nothing overflows", which would
    // hold just as well if the instance were simply clipping.
    //
    // 360px less a 40px heading fits ten 32px rows; less a 30px band as well,
    // nine. The numbers come from the fixture so they move together with it.
    await gridReady(canvasElement);

    await expect(rowCount(canvasElement)).toBe(9);
  },
};

export const ATallerBandCostsAnotherRow: Story = {
  render: () => withFloating({ floatingFilterHeight: 30 + ROW_HEIGHT }),
  play: async ({ canvasElement }) => {
    // A band one row taller, and the instance holds one row fewer — which is
    // what shows the declared height is what the engine used, rather than the
    // nine above being a coincidence of this particular viewport.
    await gridReady(canvasElement);

    await expect(rowCount(canvasElement)).toBe(8);
  },
};

export const NoBandCostsNothing: Story = {
  render: () => mountGrid({ data: instruments(40) }),
  play: async ({ canvasElement }) => {
    // The other end of the same measurement: ten without a band.
    await gridReady(canvasElement);

    await expect(rowCount(canvasElement)).toBe(10);
  },
};

// --- it filters -------------------------------------------------------------

export const TypingInABoxFiltersTheRows: Story = {
  play: async ({ canvasElement }) => {
    // The one behavioural check here: the strip is wired to the same model the
    // header boxes are, which a story is the only place to see.
    await gridReady(canvasElement);
    const before = dataRows(canvasElement).length;

    await typeInto(boxFor(canvasElement, 'Instrument'), 'INS 7');
    await gridReady(canvasElement);

    await expect(dataRows(canvasElement).length).toBeLessThan(before);
    await expect(cellText(cellsOf(dataRows(canvasElement)[0]!)[0]!)).toContain('INS 7');
  },
};

export const ClickingABoxDoesNotSortTheColumn: Story = {
  play: async ({ canvasElement }) => {
    // The strip sits under the headings, and a click on a heading sorts it.
    // Nothing should carry from one to the other.
    await gridReady(canvasElement);
    const first = cellText(cellsOf(dataRows(canvasElement)[0]!)[0]!);

    await userEvent.click(boxFor(canvasElement, 'Price'));
    await gridReady(canvasElement);

    await expect(cellText(cellsOf(dataRows(canvasElement)[0]!)[0]!)).toBe(first);
  },
};
