import { describe, expect, it } from 'vite-plus/test';
import type { DisplayRow } from '../../layout/types.js';
import { boundsOf, clamp, contains, edgesOf, rowIdsIn } from './range-model.js';

/**
 * The rectangle, on its own.
 *
 * All of this is arithmetic over the projection, so it is worth testing without
 * a grid: the cases that matter are dragging backwards, the flow layout showing
 * one row twice, and a range outliving the rows it was drawn over.
 */

const range = (anchorRow: number, anchorColumn: number, headRow: number, headColumn: number) => ({
  anchorRow,
  anchorColumn,
  headRow,
  headColumn,
});

const rows = (...ids: string[]): DisplayRow[] =>
  ids.map((rowId, i) => ({ id: `${rowId}#${i}`, rowId }));

describe('range bounds', () => {
  it('normalises a range dragged down and right', () => {
    expect(boundsOf(range(1, 1, 3, 4))).toEqual({
      firstRow: 1,
      lastRow: 3,
      firstColumn: 1,
      lastColumn: 4,
    });
  });

  it('normalises a range dragged up and left', () => {
    // The reader started at the bottom right. Same rectangle.
    expect(boundsOf(range(3, 4, 1, 1))).toEqual({
      firstRow: 1,
      lastRow: 3,
      firstColumn: 1,
      lastColumn: 4,
    });
  });

  it('keeps the corners apart, so extending past the anchor flips the shape', () => {
    // Held as anchor and head rather than as bounds precisely for this: the
    // anchor stays where the range began while the head follows the caret.
    const dragged = range(5, 5, 2, 2);
    expect(boundsOf(dragged)).toEqual({
      firstRow: 2,
      lastRow: 5,
      firstColumn: 2,
      lastColumn: 5,
    });
    expect(dragged.anchorRow).toBe(5);
  });

  it('is a single cell when it has not been extended', () => {
    expect(boundsOf(range(2, 2, 2, 2))).toEqual({
      firstRow: 2,
      lastRow: 2,
      firstColumn: 2,
      lastColumn: 2,
    });
  });
});

describe('membership', () => {
  it('covers every cell between the corners', () => {
    const r = range(1, 1, 2, 2);
    expect(contains(r, 1, 1)).toBe(true);
    expect(contains(r, 2, 2)).toBe(true);
    expect(contains(r, 1, 2)).toBe(true);
  });

  it('excludes what is outside on any side', () => {
    const r = range(1, 1, 2, 2);
    expect(contains(r, 0, 1)).toBe(false);
    expect(contains(r, 3, 1)).toBe(false);
    expect(contains(r, 1, 0)).toBe(false);
    expect(contains(r, 1, 3)).toBe(false);
  });
});

describe('edges', () => {
  it('gives a single cell all four', () => {
    expect(edgesOf(range(2, 2, 2, 2), 2, 2)).toEqual({
      top: true,
      bottom: true,
      left: true,
      right: true,
    });
  });

  it('gives a middle cell none, so the outline is the rectangle and not a lattice', () => {
    expect(edgesOf(range(0, 0, 2, 2), 1, 1)).toEqual({
      top: false,
      bottom: false,
      left: false,
      right: false,
    });
  });

  it('gives a corner two, and a side one', () => {
    const r = range(0, 0, 2, 2);
    expect(edgesOf(r, 0, 0)).toMatchObject({ top: true, left: true, bottom: false, right: false });
    expect(edgesOf(r, 1, 0)).toMatchObject({ left: true, top: false, bottom: false, right: false });
  });
});

describe('the rows a range stands for', () => {
  it('reads them in display order', () => {
    const projection = rows('a', 'b', 'c', 'd');

    expect(
      rowIdsIn(projection, { firstRow: 1, lastRow: 2, firstColumn: 0, lastColumn: 0 }),
    ).toEqual(['b', 'c']);
  });

  it('takes a row once when the layout has drawn it twice', () => {
    // The flow layout re-emits an ancestor atop each instance it breaks across.
    // A range spanning the break would otherwise copy that row twice.
    const projection = rows('group', 'a', 'b', 'group', 'c');

    expect(
      rowIdsIn(projection, { firstRow: 0, lastRow: 4, firstColumn: 0, lastColumn: 0 }),
    ).toEqual(['group', 'a', 'b', 'c']);
  });

  it('stands for a collapsed group itself, not the rows hidden behind it', () => {
    // The projection is what is displayed, so hidden children are not in it —
    // and taking them would be taking what the reader cannot see.
    const projection = rows('collapsed-group', 'next');

    expect(
      rowIdsIn(projection, { firstRow: 0, lastRow: 1, firstColumn: 0, lastColumn: 0 }),
    ).toEqual(['collapsed-group', 'next']);
  });

  it('ignores indices the projection no longer has', () => {
    const projection = rows('a');

    expect(
      rowIdsIn(projection, { firstRow: 0, lastRow: 5, firstColumn: 0, lastColumn: 0 }),
    ).toEqual(['a']);
  });
});

describe('clamping', () => {
  it('pulls a range back inside a grid that has shrunk', () => {
    // A filter can drop the rows a range was drawn over while it is still open.
    expect(clamp(range(0, 0, 9, 9), 3, 2)).toEqual({
      anchorRow: 0,
      anchorColumn: 0,
      headRow: 2,
      headColumn: 1,
    });
  });

  it('leaves a range that already fits alone', () => {
    const r = range(0, 0, 1, 1);
    expect(clamp(r, 5, 5)).toEqual(r);
  });

  it('has nothing to clamp to when the grid is empty', () => {
    expect(clamp(range(0, 0, 1, 1), 0, 3)).toBeNull();
    expect(clamp(range(0, 0, 1, 1), 3, 0)).toBeNull();
  });
});
