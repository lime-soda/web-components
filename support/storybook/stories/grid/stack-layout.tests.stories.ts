import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect } from 'storybook/test';
import '@lime-soda/grid';
import '@lime-soda/grid/layouts';
import { TreeModule } from '@lime-soda/grid/tree';
import { SortModule } from '@lime-soda/grid/sort';
import {
  cellText,
  cellsOf,
  dataRows,
  getByRole,
  gridReady,
  queryAllByRole,
} from './shadow-queries.js';
import {
  type Instrument,
  grouped,
  instruments,
  mountGrid,
  testStoryParameters,
} from './fixtures.js';

/**
 * The conventional vertical layout, where the split is the whole design.
 *
 * The header is rendered outside the scrolling body so it cannot be scrolled
 * away, and the two are kept in line by sharing a column template rather than
 * by measuring each other. Everything that can go wrong here is a disagreement
 * between the two halves: a header that drifts sideways, a body that starts in
 * the wrong place, a sticky group band that blinks at a boundary.
 */

const flat = instruments(200);
const tree = grouped(6, 20);

const stack = (data: Instrument[], modules: Instrument extends never ? never : object[] = []) =>
  mountGrid({
    data,
    height: 320,
    width: 560,
    options: { layout: 'stack', modules: modules as never },
  });

const meta: Meta = {
  title: 'Grid/Tests/Stack layout',
  parameters: testStoryParameters,
  render: () => stack(flat),
};

export default meta;
type Story = StoryObj;

const shadow = (canvas: HTMLElement) => canvas.querySelector('ls-grid')!.shadowRoot!;
const viewport = (canvas: HTMLElement) => shadow(canvas).querySelector('.viewport') as HTMLElement;
const header = (canvas: HTMLElement) =>
  shadow(canvas).querySelector('.stack-chrome-header') as HTMLElement;
const scroller = (canvas: HTMLElement) => shadow(canvas).querySelector('.scroller') as HTMLElement;
const stickyBand = (canvas: HTMLElement) => shadow(canvas).querySelector('.stack-sticky');

const scrollTo = async (canvas: HTMLElement, top: number) => {
  scroller(canvas).scrollTop = top;
  await gridReady(canvas);
};

const firstRowText = (canvas: HTMLElement) => cellText(cellsOf(dataRows(canvas)[0]!)[0]!);

// --- the header -------------------------------------------------------------

export const TheHeaderDoesNotMoveWhileTheBodyScrolls: Story = {
  play: async ({ canvasElement }) => {
    await gridReady(canvasElement);
    const top = viewport(canvasElement).getBoundingClientRect().top;
    const headerTop = () => Math.round(header(canvasElement).getBoundingClientRect().top);

    await expect(headerTop()).toBe(Math.round(top));

    await scrollTo(canvasElement, 2000);
    await expect(headerTop()).toBe(Math.round(top));

    await scrollTo(canvasElement, 10_000);
    await expect(headerTop()).toBe(Math.round(top));
  },
};

export const TheBodyStartsWhereTheHeaderEnds: Story = {
  play: async ({ canvasElement }) => {
    // A gap or an overlap here is the two halves disagreeing about where the
    // split is, which shows as a clipped first row.
    await gridReady(canvasElement);

    await expect(Math.round(header(canvasElement).getBoundingClientRect().bottom)).toBe(
      Math.round(scroller(canvasElement).getBoundingClientRect().top),
    );
  },
};

export const TheHeaderStaysInLineSideways: Story = {
  play: async ({ canvasElement }) => {
    // The header is outside the scroller, so it has to be told how far the body
    // has gone. Left behind, every column heading sits over the wrong column.
    await gridReady(canvasElement);
    const heading = () => getByRole(canvasElement, 'columnheader', { name: 'Price' });
    const cell = () => cellsOf(dataRows(canvasElement)[0]!)[1]!;
    await expect(
      Math.abs(heading().getBoundingClientRect().left - cell().getBoundingClientRect().left),
    ).toBeLessThanOrEqual(1);

    scroller(canvasElement).scrollLeft = 200;
    await gridReady(canvasElement);

    await expect(
      Math.abs(heading().getBoundingClientRect().left - cell().getBoundingClientRect().left),
    ).toBeLessThanOrEqual(1);
  },
};

// --- the body ---------------------------------------------------------------

export const TheBodyWindowsItsRows: Story = {
  render: () => stack(instruments(5000)),
  play: async ({ canvasElement }) => {
    // Five thousand rows, a few dozen drawn. Rendering them all is what the
    // window exists to avoid.
    await gridReady(canvasElement);

    await expect(dataRows(canvasElement).length).toBeLessThan(40);
  },
};

export const ScrollingAdvancesTheWindowAndComesBack: Story = {
  play: async ({ canvasElement }) => {
    await gridReady(canvasElement);
    const first = firstRowText(canvasElement);

    await scrollTo(canvasElement, 4000);
    await expect(firstRowText(canvasElement)).not.toBe(first);

    await scrollTo(canvasElement, 0);
    await expect(firstRowText(canvasElement)).toBe(first);
  },
};

export const TheScrollbarDescribesTheWholeDataSet: Story = {
  render: () => stack(instruments(1000)),
  play: async ({ canvasElement }) => {
    // Otherwise the bar's size lies about how much there is, and dragging it
    // travels a different distance than it appears to.
    await gridReady(canvasElement);

    await expect(scroller(canvasElement).scrollHeight).toBeGreaterThan(1000 * 32);
  },
};

// --- the sticky group band --------------------------------------------------

const withTree = () => [
  new TreeModule<Instrument>({ getParentId: (row) => row.parentId, defaultExpanded: true }),
];

export const TheGroupBandSitsOverItsOwnHeadingAtTheTop: Story = {
  render: () => stack(tree, withTree()),
  play: async ({ canvasElement }) => {
    // Deliberate: hiding the band while the real heading is visible is what made
    // it blink at every boundary. It is always there and, at the top, sits
    // exactly over the heading it duplicates — so it cannot be told apart.
    await gridReady(canvasElement);
    const band = stickyBand(canvasElement) as HTMLElement;
    await expect(band).toBeTruthy();

    const heading = cellsOf(dataRows(canvasElement)[0]!)[0]!;
    await expect(
      Math.abs(band.getBoundingClientRect().top - heading.getBoundingClientRect().top),
    ).toBeLessThan(1.5);
  },
};

export const TheGroupBandFollowsTheScrollIntoTheNextGroup: Story = {
  render: () => stack(tree, withTree()),
  play: async ({ canvasElement }) => {
    await gridReady(canvasElement);
    // The band is an instance and carries its own aria-label, so its name is
    // not its contents — the group's name is in the cell it repeats.
    const bandText = () => {
      const [row] = queryAllByRole(stickyBand(canvasElement)!, 'row', { includeHidden: true });
      return row ? cellText(cellsOf(row)[0]!) : '';
    };
    await expect(bandText()).toContain('Group 0');

    await scrollTo(canvasElement, 1200);

    await expect(bandText()).not.toContain('Group 0');
  },
};

export const TheGroupBandSitsBeneathTheColumnHeader: Story = {
  render: () => stack(tree, withTree()),
  play: async ({ canvasElement }) => {
    await gridReady(canvasElement);
    await scrollTo(canvasElement, 400);

    const band = (stickyBand(canvasElement) as HTMLElement).getBoundingClientRect();
    await expect(band.top).toBeGreaterThanOrEqual(
      header(canvasElement).getBoundingClientRect().bottom - 1,
    );
  },
};

export const NothingIsPinnedWithoutATree: Story = {
  play: async ({ canvasElement }) => {
    // There are no groups to pin, so a band would be an empty strip taking up
    // the first row's worth of height.
    await gridReady(canvasElement);
    await scrollTo(canvasElement, 800);

    await expect(stickyBand(canvasElement)).toBeNull();
  },
};

export const TheHeaderStaysPinnedWithModulesInstalled: Story = {
  render: () => stack(tree, [...withTree(), new SortModule<Instrument>()]),
  play: async ({ canvasElement }) => {
    // Modules add markup to the header. None of it may push the header into the
    // scroller or the whole split comes apart.
    await gridReady(canvasElement);
    const top = Math.round(header(canvasElement).getBoundingClientRect().top);

    await scrollTo(canvasElement, 2000);

    await expect(Math.round(header(canvasElement).getBoundingClientRect().top)).toBe(top);
    // ...and the heading is still a control, not just text.
    await expect(getByRole(canvasElement, 'button', { name: 'Price' })).toBeTruthy();
  },
};
