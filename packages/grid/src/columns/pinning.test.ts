import { describe, expect, it } from 'vite-plus/test';
import { pinPlacements } from './pinning.js';
import type { PinnableColumn } from './pinning.js';

/**
 * Where a pinned column comes to rest.
 *
 * Pure geometry, so it is worth pinning down here rather than inferring it from
 * a screenshot: an offset that is wrong by one column's width puts a pinned
 * column on top of its neighbour, which looks like a z-index bug and is not.
 */

const column = (colId: string, width: number, pinned?: 'left' | 'right'): PinnableColumn =>
  pinned === undefined ? { colId, width } : { colId, width, pinned };

describe('pinPlacements', () => {
  it('stacks left-pinned columns by the widths before them', () => {
    const placements = pinPlacements(
      [column('a', 80, 'left'), column('b', 120, 'left'), column('c', 200)],
      'stack',
    );

    expect(placements.get('a')?.offset).toBe(0);
    expect(placements.get('b')?.offset).toBe(80);
    expect(placements.has('c')).toBe(false);
  });

  it('stacks right-pinned columns from the right edge inwards', () => {
    // Counted from the end, so the last column sits flush and the one before it
    // clears exactly that column's width.
    const placements = pinPlacements(
      [column('a', 200), column('b', 120, 'right'), column('c', 80, 'right')],
      'stack',
    );

    expect(placements.get('c')?.offset).toBe(0);
    expect(placements.get('b')?.offset).toBe(80);
  });

  it('marks only the column that meets the scrolling ones', () => {
    // The divider belongs at the seam. On every other pinned column it would
    // draw a line between two columns that never separate.
    const placements = pinPlacements(
      [
        column('a', 80, 'left'),
        column('b', 120, 'left'),
        column('c', 200),
        column('d', 90, 'right'),
        column('e', 60, 'right'),
      ],
      'stack',
    );

    expect(placements.get('a')?.edge).toBe(false);
    expect(placements.get('b')?.edge).toBe(true);
    expect(placements.get('d')?.edge).toBe(true);
    expect(placements.get('e')?.edge).toBe(false);
  });

  it('pins nothing in the flow layout', () => {
    // An instance is sized to its own columns and the scroller moves between
    // instances, so nothing slides out from under the viewport. A sticky column
    // there would only detach itself from the rows it belongs to.
    const placements = pinPlacements([column('a', 80, 'left'), column('b', 120, 'right')], 'flow');

    expect(placements.size).toBe(0);
  });

  it('handles a column pinned on each side with nothing between', () => {
    const placements = pinPlacements([column('a', 80, 'left'), column('b', 120, 'right')], 'stack');

    expect(placements.get('a')).toEqual({ side: 'left', offset: 0, edge: true });
    expect(placements.get('b')).toEqual({ side: 'right', offset: 0, edge: true });
  });
});
