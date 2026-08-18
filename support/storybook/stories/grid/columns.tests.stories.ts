import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect, userEvent } from 'storybook/test';
import '@lime-soda/grid';
import '@lime-soda/grid/layouts';
import { ColumnsModule } from '@lime-soda/grid/columns';
import {
  accessibleName,
  cellsOf,
  dataRows,
  getAllByRole,
  getByRole,
  gridReady,
  pressKey,
  queryAllByRole,
} from './shadow-queries.js';
import {
  type Instrument,
  columns,
  instruments,
  mountGrid,
  testStoryParameters,
} from './fixtures.js';

/**
 * Arranging columns, driven the way a user drives it.
 *
 * Nothing here reaches for the grid's api or its module objects, and nothing
 * asserts on internal state: a column is wider because its heading measures
 * wider, and a column moved because the headings now read in a different order.
 * That is the only version of these tests that can fail for the reason a user
 * would notice.
 *
 * Elements are found by role. Testing Library stops at a shadow root and this
 * grid nests four, so the queries come from `./shadow-queries`, which walks the
 * composed tree the way the accessibility tree does.
 */

const data = instruments(6);

const arrangeable = (options: ConstructorParameters<typeof ColumnsModule>[0] = {}, extra = {}) =>
  mountGrid({
    data,
    options: {
      layout: 'stack',
      modules: [new ColumnsModule<Instrument>(options)],
      ...extra,
    },
    height: 260,
  });

const meta: Meta = {
  title: 'Grid/Tests/Columns',
  parameters: testStoryParameters,
  render: () => arrangeable(),
};

export default meta;
type Story = StoryObj;

// --- helpers ---------------------------------------------------------------

/** The column headings, in the order they are drawn. */
const headingOrder = (canvas: HTMLElement): string[] =>
  getAllByRole(canvas, 'columnheader').map(accessibleName);

const heading = (canvas: HTMLElement, name: string): HTMLElement =>
  getByRole(canvas, 'columnheader', { name });

const widthOf = (element: HTMLElement) => element.getBoundingClientRect().width;

/**
 * Drags from one point to another with the pointer.
 *
 * Through `userEvent` rather than dispatched events, so the sequence is the one
 * a browser produces — including the moves between, which is what a handler
 * tracking a drag actually reads.
 */
const dragTo = (target: HTMLElement, from: { x: number; y: number }, toX: number) =>
  userEvent.pointer([
    { keys: '[MouseLeft>]', target, coords: { clientX: from.x, clientY: from.y } },
    { coords: { clientX: (from.x + toX) / 2, clientY: from.y } },
    { coords: { clientX: toX, clientY: from.y } },
    { keys: '[/MouseLeft]', coords: { clientX: toX, clientY: from.y } },
  ]);

const grabPoint = (element: HTMLElement) => {
  const box = element.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
};

// --- resize ----------------------------------------------------------------

export const ResizeByDragging: Story = {
  play: async ({ canvasElement }) => {
    await gridReady(canvasElement);
    const instrument = heading(canvasElement, 'Instrument');
    const handle = getByRole(canvasElement, 'button', { name: 'Resize Instrument' });
    const before = widthOf(instrument);

    await dragTo(handle, grabPoint(handle), grabPoint(handle).x + 100);

    await expect(widthOf(instrument)).toBeCloseTo(before + 100, -1);
  },
};

export const ResizeFollowsThePointerFarFromTheHandle: Story = {
  play: async ({ canvasElement }) => {
    // The pointer leaves the handle on the first move of any real drag, so the
    // width has to keep following it well outside those few pixels.
    await gridReady(canvasElement);
    const instrument = heading(canvasElement, 'Instrument');
    const handle = getByRole(canvasElement, 'button', { name: 'Resize Instrument' });
    const before = widthOf(instrument);

    await dragTo(handle, grabPoint(handle), grabPoint(handle).x + 250);

    await expect(widthOf(instrument)).toBeGreaterThan(before + 200);
  },
};

export const ResizeFromTheKeyboard: Story = {
  play: async ({ canvasElement }) => {
    // A drag is not an affordance everyone can use, and a column of numbers
    // ellipsised to nothing is unreadable rather than merely inconvenient.
    await gridReady(canvasElement);
    const instrument = heading(canvasElement, 'Instrument');
    const before = widthOf(instrument);

    getByRole(canvasElement, 'button', { name: 'Resize Instrument' }).focus();
    await pressKey('ArrowRight');

    await expect(widthOf(instrument)).toBe(before + 10);
  },
};

// --- reorder ---------------------------------------------------------------

export const ReorderByDragging: Story = {
  play: async ({ canvasElement }) => {
    await gridReady(canvasElement);
    await expect(headingOrder(canvasElement)).toEqual(['Instrument', 'Price', 'Size']);

    const grip = getByRole(canvasElement, 'button', { name: 'Move Instrument' });
    const size = heading(canvasElement, 'Size');

    await dragTo(grip, grabPoint(grip), grabPoint(size).x);

    await expect(headingOrder(canvasElement)).toEqual(['Price', 'Size', 'Instrument']);
  },
};

export const ReorderFromTheKeyboard: Story = {
  play: async ({ canvasElement }) => {
    await gridReady(canvasElement);

    getByRole(canvasElement, 'button', { name: 'Move Instrument' }).focus();
    await pressKey('ArrowRight');

    await expect(headingOrder(canvasElement)).toEqual(['Price', 'Instrument', 'Size']);
  },
};

export const ReorderMovesTheDataWithTheHeading: Story = {
  play: async ({ canvasElement }) => {
    // The heading is only half of it: the values have to travel with it, or the
    // grid is showing prices under a heading that says Instrument.
    await gridReady(canvasElement);
    const firstRow = () => cellsOf(dataRows(canvasElement)[0]!).map(accessibleName);
    await expect(firstRow()[0]).toBe('INS 0');

    getByRole(canvasElement, 'button', { name: 'Move Instrument' }).focus();
    await pressKey('ArrowRight');

    await expect(headingOrder(canvasElement)[1]).toBe('Instrument');
    await expect(firstRow()[1]).toBe('INS 0');
  },
};

// --- opting out ------------------------------------------------------------

export const NoHandlesWhenDisabled: Story = {
  render: () => arrangeable({ resizable: false, reorderable: false }),
  play: async ({ canvasElement }) => {
    // The affordance has to actually disappear: a control that does nothing is
    // worse than none, and a screen reader announces it either way.
    await gridReady(canvasElement);

    await expect(queryAllByRole(canvasElement, 'button', { name: /^Resize/ })).toHaveLength(0);
    await expect(queryAllByRole(canvasElement, 'button', { name: /^Move/ })).toHaveLength(0);
  },
};

export const ColumnOptsOutOfResizing: Story = {
  render: () =>
    arrangeable({}, { columns: [{ ...columns[0]!, resizable: false }, ...columns.slice(1)] }),
  play: async ({ canvasElement }) => {
    await gridReady(canvasElement);

    await expect(
      queryAllByRole(canvasElement, 'button', { name: 'Resize Instrument' }),
    ).toHaveLength(0);
    await expect(queryAllByRole(canvasElement, 'button', { name: 'Resize Price' })).toHaveLength(1);
  },
};

// --- pinning ---------------------------------------------------------------

/** Wider than the frame on purpose, so there is something to scroll under. */
const pinned = () =>
  mountGrid({
    data,
    options: {
      layout: 'stack',
      modules: [new ColumnsModule<Instrument>()],
      columns: [
        { ...columns[0]!, pinned: 'left' as const },
        { ...columns[1]!, width: 300 },
        { ...columns[2]!, width: 300 },
      ],
    },
    // 840px of columns in a 500px frame, so there is something to scroll.
    width: 500,
    height: 260,
  });

/**
 * Walks right with the arrow keys until the grid has scrolled.
 *
 * A real user reaches a column off the right edge by moving to it, and the
 * browser brings it into view. Setting `scrollLeft` would be the test reaching
 * past the interface to arrange the thing it then measures.
 */
async function arrowRightUntilScrolled(canvas: HTMLElement): Promise<void> {
  const first = cellsOf(dataRows(canvas)[0]!)[0]!;
  await userEvent.click(first);
  for (let i = 0; i < 6; i += 1) await pressKey('ArrowRight');
}

export const PinnedColumnStaysWhileTheRestScroll: Story = {
  render: () => pinned(),
  play: async ({ canvasElement }) => {
    await gridReady(canvasElement);
    const held = heading(canvasElement, 'Instrument');
    const free = heading(canvasElement, 'Price');
    const before = {
      held: held.getBoundingClientRect().left,
      free: free.getBoundingClientRect().left,
    };

    await arrowRightUntilScrolled(canvasElement);

    const after = {
      held: held.getBoundingClientRect().left,
      free: free.getBoundingClientRect().left,
    };

    await expect(after.free).toBeLessThan(before.free);
    await expect(Math.abs(after.held - before.held)).toBeLessThanOrEqual(1);
  },
};

export const PinnedHeadingStaysWithItsColumn: Story = {
  render: () => pinned(),
  play: async ({ canvasElement }) => {
    // Heading and cells are separate elements in separate rows. A column that
    // stops in two places reads as a rendering fault, not as one pinned column.
    await gridReady(canvasElement);
    const held = heading(canvasElement, 'Instrument');

    await arrowRightUntilScrolled(canvasElement);

    const cell = cellsOf(dataRows(canvasElement)[0]!)[0]!;
    await expect(
      Math.abs(held.getBoundingClientRect().left - cell.getBoundingClientRect().left),
    ).toBeLessThanOrEqual(1);
  },
};

export const PinnedColumnStaysReadable: Story = {
  render: () => pinned(),
  play: async ({ canvasElement }) => {
    // The point of pinning: the instrument is still legible after scrolling,
    // rather than having rows slide visibly beneath a transparent column.
    await gridReady(canvasElement);
    const cell = cellsOf(dataRows(canvasElement)[0]!)[0]!;
    await expect(accessibleName(cell)).toBe('INS 0');

    await arrowRightUntilScrolled(canvasElement);

    const box = cell.getBoundingClientRect();
    const painted = deepestAt(box.left + box.width / 2, box.top + box.height / 2);
    await expect(belongsTo(cell, painted)).toBe(true);
  },
};

export const PinningDoesNothingInFlow: Story = {
  render: () =>
    arrangeable(
      {},
      {
        layout: 'flow',
        columns: [{ ...columns[0]!, pinned: 'left' as const }, ...columns.slice(1)],
      },
    ),
  play: async ({ canvasElement }) => {
    // An instance is sized to its own columns and the scroller moves between
    // instances, so nothing slides under a pinned column for it to stay in
    // front of. The columns read in their declared order, unmoved.
    await gridReady(canvasElement);

    await expect(headingOrder(canvasElement).slice(0, 3)).toEqual(['Instrument', 'Price', 'Size']);
  },
};

/** The deepest element painted at a point; `elementFromPoint` stops at each host. */
function deepestAt(x: number, y: number): Element | null {
  let element = document.elementFromPoint(x, y);
  while (element?.shadowRoot) {
    const inner = element.shadowRoot.elementFromPoint(x, y);
    if (!inner || inner === element) break;
    element = inner;
  }
  return element;
}

function belongsTo(owner: Element, node: Element | null): boolean {
  let current: Element | null = node;
  while (current) {
    if (current === owner) return true;
    current = current.parentElement ?? (current.getRootNode() as ShadowRoot).host ?? null;
  }
  return false;
}
