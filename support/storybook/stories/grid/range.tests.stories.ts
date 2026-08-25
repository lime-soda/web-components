import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect } from 'storybook/test';
import '@lime-soda/grid';
import '@lime-soda/grid/layouts';
import { RangeModule } from '@lime-soda/grid/range';
import type { Grid } from '@lime-soda/grid';
import {
  cellsOf,
  dataRows,
  gridReady,
  pointerDownOn,
  pointerOver,
  pointerUpOn,
  pressKey,
  settleRenders,
  tabInto,
} from './shadow-queries.js';
import { type Instrument, instruments, mountGrid, testStoryParameters } from './fixtures.js';

/**
 * Selecting a rectangle of cells.
 *
 * Driven the way a person drives it: tab in and hold shift with the arrows, or
 * press and drag across the cells. What is asserted is which cells the grid
 * says are in the range — the rectangle's arithmetic is a unit test, and
 * repeating it here would only prove the module can call itself.
 *
 * How the range *looks* is Chromatic's, not an assertion's. What is checked is
 * the edge classes rather than any colour, because the outline being the
 * rectangle's rather than every cell's is structural: get it wrong and a range
 * reads as a lattice of boxes.
 */

const withRange = () =>
  mountGrid({
    data: instruments(6),
    width: 500,
    height: 300,
    options: { layout: 'stack', modules: [new RangeModule<Instrument>()] },
  });

const meta: Meta = {
  title: 'Grid/Tests/Cell range',
  parameters: testStoryParameters,
  render: () => withRange(),
};

export default meta;
type Story = StoryObj;

const api = (canvas: HTMLElement) => (canvas.querySelector('ls-grid') as Grid<Instrument>).api;

const cellAt = (canvas: HTMLElement, row: number, column: number) =>
  cellsOf(dataRows(canvas)[row]!)[column]!;

/** Which cells the grid has marked, by position. */
const marked = (canvas: HTMLElement) => {
  const out: string[] = [];
  dataRows(canvas).forEach((row, r) => {
    cellsOf(row).forEach((cell, c) => {
      if (cell.classList.contains('ls-grid-in-range')) out.push(`${r},${c}`);
    });
  });
  return out;
};

// --- the keyboard -----------------------------------------------------------

export const ShiftArrowDrawsARange: Story = {
  play: async ({ canvasElement }) => {
    await gridReady(canvasElement);
    tabInto(canvasElement);

    await pressKey('ArrowDown', { shiftKey: true });
    await pressKey('ArrowRight', { shiftKey: true });

    await expect(marked(canvasElement)).toEqual(['0,0', '0,1', '1,0', '1,1']);
  },
};

export const ShiftArrowBackCollapsesThroughTheAnchor: Story = {
  play: async ({ canvasElement }) => {
    // The anchor stays where the range began, so coming back shrinks the
    // rectangle rather than growing it the other way.
    await gridReady(canvasElement);
    tabInto(canvasElement);
    await pressKey('ArrowDown', { shiftKey: true });
    await pressKey('ArrowDown', { shiftKey: true });

    await pressKey('ArrowUp', { shiftKey: true });

    await expect(marked(canvasElement)).toEqual(['0,0', '1,0']);
  },
};

export const APlainArrowClearsIt: Story = {
  play: async ({ canvasElement }) => {
    // A plain arrow is a move, not a range operation.
    await gridReady(canvasElement);
    tabInto(canvasElement);
    await pressKey('ArrowDown', { shiftKey: true });

    await pressKey('ArrowDown');

    await expect(marked(canvasElement)).toEqual([]);
  },
};

// --- the mouse --------------------------------------------------------------

export const DraggingDrawsARange: Story = {
  play: async ({ canvasElement }) => {
    await gridReady(canvasElement);

    pointerDownOn(cellAt(canvasElement, 1, 0));
    pointerOver(cellAt(canvasElement, 2, 1));
    pointerUpOn(cellAt(canvasElement, 2, 1));
    await settleRenders(canvasElement);

    await expect(marked(canvasElement)).toEqual(['1,0', '1,1', '2,0', '2,1']);
  },
};

export const ShiftClickReCutsFromTheAnchor: Story = {
  play: async ({ canvasElement }) => {
    await gridReady(canvasElement);
    pointerDownOn(cellAt(canvasElement, 0, 0));
    pointerUpOn(cellAt(canvasElement, 0, 0));

    pointerDownOn(cellAt(canvasElement, 2, 1), { shiftKey: true });
    pointerUpOn(cellAt(canvasElement, 2, 1));
    await settleRenders(canvasElement);

    await expect(marked(canvasElement)).toEqual(['0,0', '0,1', '1,0', '1,1', '2,0', '2,1']);
  },
};

export const ReleasingOutsideTheGridEndsTheDrag: Story = {
  play: async ({ canvasElement }) => {
    // The button very often comes up off the edge of the grid. If the drag
    // outlived it, the range would keep following the pointer afterwards.
    await gridReady(canvasElement);
    pointerDownOn(cellAt(canvasElement, 0, 0));
    pointerOver(cellAt(canvasElement, 1, 0));
    pointerUpOn(document.body);

    pointerOver(cellAt(canvasElement, 4, 2));
    await settleRenders(canvasElement);

    await expect(marked(canvasElement)).toEqual(['0,0', '1,0']);
  },
};

// --- what it reports --------------------------------------------------------

export const TheRangeIsReadableFromTheApi: Story = {
  play: async ({ canvasElement }) => {
    // Ids and column ids, which is what an application acts on — not indices
    // into a projection it cannot see.
    await gridReady(canvasElement);
    tabInto(canvasElement);
    await pressKey('ArrowDown', { shiftKey: true });

    await expect(api(canvasElement).getCellRange()).toEqual({
      rowIds: ['i0', 'i1'],
      colIds: ['name'],
    });
  },
};

export const NothingIsSelectedToStartWith: Story = {
  play: async ({ canvasElement }) => {
    await gridReady(canvasElement);

    await expect(api(canvasElement).getCellRange()).toBeNull();
    await expect(marked(canvasElement)).toEqual([]);
  },
};

// --- what it announces ------------------------------------------------------

export const ASelectedCellSaysSo: Story = {
  play: async ({ canvasElement }) => {
    // The tint is for people who can see it. `gridcell` takes `aria-selected`,
    // and without it a reader working through the grid is told nothing about a
    // block someone has marked out.
    await gridReady(canvasElement);
    tabInto(canvasElement);
    await pressKey('ArrowDown', { shiftKey: true });

    const selected = dataRows(canvasElement).flatMap((row) =>
      cellsOf(row).filter((cell) => cell.getAttribute('aria-selected') === 'true'),
    );
    await expect(selected).toHaveLength(2);
  },
};

export const NothingSaysSelectedWithoutARange: Story = {
  play: async ({ canvasElement }) => {
    await gridReady(canvasElement);

    const selected = dataRows(canvasElement).flatMap((row) =>
      cellsOf(row).filter((cell) => cell.getAttribute('aria-selected') !== null),
    );
    await expect(selected).toHaveLength(0);
  },
};

export const TheGridSaysMoreThanOneCanBeSelected: Story = {
  play: async ({ canvasElement }) => {
    // On the grid rather than the cells, and only because something installed
    // can hold more than one selection at a time.
    await gridReady(canvasElement);

    await expect(canvasElement.querySelector('ls-grid')!.getAttribute('aria-multiselectable')).toBe(
      'true',
    );
  },
};

// --- the outline ------------------------------------------------------------

export const TheActiveCellIsTheOneWithoutTheTint: Story = {
  play: async ({ canvasElement }) => {
    // A spreadsheet leaves the caret's cell unfilled inside the tinted block, so
    // the focus ring is not sitting on top of a fill and competing with it.
    // Asserted as a class rather than a colour: which cell is exempt is the
    // structure, and the colour is Chromatic's to judge.
    await gridReady(canvasElement);
    tabInto(canvasElement);
    await pressKey('ArrowDown', { shiftKey: true });

    const [anchor, head] = [cellAt(canvasElement, 0, 0), cellAt(canvasElement, 1, 0)];
    // Focus follows the head, so that is the cell exempted.
    await expect(head.hasAttribute('data-focused')).toBe(true);
    await expect(anchor.hasAttribute('data-focused')).toBe(false);
    // Both are in the range; only one is the active cell.
    await expect(anchor.classList.contains('ls-grid-in-range')).toBe(true);
    await expect(head.classList.contains('ls-grid-in-range')).toBe(true);
  },
};

export const TheOutlineBelongsToTheRectangle: Story = {
  play: async ({ canvasElement }) => {
    // Every cell drawing its own box gives a lattice. Only the cells on an edge
    // draw that edge, so a middle cell draws none.
    await gridReady(canvasElement);
    tabInto(canvasElement);
    for (let i = 0; i < 2; i += 1) await pressKey('ArrowDown', { shiftKey: true });
    for (let i = 0; i < 2; i += 1) await pressKey('ArrowRight', { shiftKey: true });

    const classesAt = (row: number, column: number) => [
      ...cellAt(canvasElement, row, column).classList,
    ];

    await expect(classesAt(0, 0)).toEqual(
      expect.arrayContaining(['ls-grid-range-top', 'ls-grid-range-left']),
    );
    await expect(classesAt(1, 1)).not.toEqual(
      expect.arrayContaining(['ls-grid-range-top', 'ls-grid-range-bottom']),
    );
    await expect(classesAt(2, 2)).toEqual(
      expect.arrayContaining(['ls-grid-range-bottom', 'ls-grid-range-right']),
    );
  },
};
