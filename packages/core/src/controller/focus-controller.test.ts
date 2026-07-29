import { describe, expect, it } from 'vitest';
import type { DisplayRow, LayoutResult, ViewportMetrics } from '../layout/types.js';
import { FlowLayoutEngine } from '../layout/flow-layout-engine.js';
import { FocusController } from './focus-controller.js';

const columns = [{ colId: 'a' }, { colId: 'b' }, { colId: 'c' }];

/** Three instances of 10 rows, laid out by the real engine. */
const buildLayout = (rowCount: number): LayoutResult => {
  const rows: DisplayRow[] = Array.from({ length: rowCount }, (_, i) => ({
    id: `r${i}`,
    rowId: `r${i}`,
  }));
  const viewport: ViewportMetrics = {
    width: 900,
    height: 360,
    rowHeight: 32,
    headerHeight: 40,
    instanceWidth: 300,
    instanceGap: 0,
  };
  return new FlowLayoutEngine().layout(rows, viewport);
};

const setup = (rowCount = 25) => {
  const layout = buildLayout(rowCount);
  const focus = new FocusController(
    () => layout,
    () => columns,
  );
  return { focus, layout };
};

const at = (focus: FocusController) => {
  const position = focus.focused.get();
  return position === null ? null : `${position.instanceId}/${position.rowKey}/${position.colId}`;
};

describe('FocusController headers', () => {
  /**
   * Headers are reachable, but only backwards. Forward movement is the common
   * one, and stepping through a header on the way to the next instance's rows
   * would put a stop in its path for the sake of the rare case.
   */

  it('goes up from the first row into the header', () => {
    const { focus } = setup();
    focus.focus({ instanceId: 'instance-0', rowKey: 'r0', colId: 'b', section: 'body' });

    expect(focus.moveRow(-1)).toBe(true);

    expect(focus.focused.get()).toEqual({
      instanceId: 'instance-0',
      rowKey: '',
      colId: 'b',
      section: 'header',
    });
  });

  it('comes back down out of the header into the first row', () => {
    const { focus } = setup();
    focus.focusHeader('instance-0', 'b');

    expect(focus.moveRow(1)).toBe(true);

    expect(at(focus)).toBe('instance-0/r0/b');
  });

  it('skips the header moving down into the next instance', () => {
    const { focus } = setup();
    focus.focus({ instanceId: 'instance-0', rowKey: 'r9', colId: 'a', section: 'body' });

    expect(focus.moveRow(1)).toBe(true);

    expect(focus.focused.get()?.section).toBe('body');
    expect(at(focus)).toBe('instance-1/r10/a');
  });

  it('leaves a header upwards into the previous instance last row', () => {
    const { focus } = setup();
    focus.focusHeader('instance-1', 'a');

    expect(focus.moveRow(-1)).toBe(true);

    expect(at(focus)).toBe('instance-0/r9/a');
  });

  it('stops at the first instance header, with nothing above it', () => {
    const { focus } = setup();
    focus.focusHeader('instance-0', 'a');

    expect(focus.moveRow(-1)).toBe(false);
  });

  it('moves across columns within the header', () => {
    const { focus } = setup();
    focus.focusHeader('instance-0', 'a');

    expect(focus.moveColumn(1)).toBe(true);

    expect(focus.focused.get()).toMatchObject({ colId: 'b', section: 'header' });
  });

  it('stays in the header when columns wrap to the next instance', () => {
    const { focus } = setup();
    focus.focusHeader('instance-0', 'c');

    expect(focus.moveColumn(1)).toBe(true);

    expect(focus.focused.get()).toMatchObject({
      instanceId: 'instance-1',
      colId: 'a',
      section: 'header',
    });
  });

  it('stays in the header when jumping instances', () => {
    const { focus } = setup();
    focus.focusHeader('instance-0', 'a');

    expect(focus.moveInstance(1)).toBe(true);

    expect(focus.focused.get()).toMatchObject({ instanceId: 'instance-1', section: 'header' });
  });

  it('lands on data when jumping to either end of the grid', () => {
    const { focus } = setup();
    focus.focusHeader('instance-1', 'a');

    expect(focus.moveToEdge('instanceStart')).toBe(true);

    expect(focus.focused.get()?.section).toBe('body');
  });

  it('is not the grid tab stop, which stays on the first body cell', () => {
    const { focus, layout } = setup();
    const firstRow = layout.instances[0]!.rows[0]!;

    expect(focus.isTabbable('instance-0', firstRow.id, 'a')).toBe(true);
    expect(focus.isHeaderFocused('instance-0', 'a')).toBe(false);
  });
});

describe('FocusController', () => {
  it('starts with nothing focused', () => {
    expect(setup().focus.focused.get()).toBeNull();
  });

  it('focuses the first cell of the first instance', () => {
    const { focus } = setup();

    focus.focusFirst();

    expect(at(focus)).toBe('instance-0/r0/a');
  });

  it('refuses to move with nothing focused', () => {
    expect(setup().focus.moveRow(1)).toBe(false);
  });

  describe('rows', () => {
    it('moves down within an instance', () => {
      const { focus } = setup();
      focus.focusFirst();

      expect(focus.moveRow(1)).toBe(true);
      expect(at(focus)).toBe('instance-0/r1/a');
    });

    it('continues into the next instance past the last row', () => {
      // The flow layout's reading order: data continues to the right, not at the
      // top of the same column.
      const { focus } = setup();
      focus.focus({ instanceId: 'instance-0', rowKey: 'r9', colId: 'a', section: 'body' });

      expect(focus.moveRow(1)).toBe(true);
      expect(at(focus)).toBe('instance-1/r10/a');
    });

    it('enters the instance header above the first row', () => {
      // The header is what sits above these rows, so that is where up goes —
      // not sideways into the previous instance.
      const { focus } = setup();
      focus.focus({ instanceId: 'instance-1', rowKey: 'r10', colId: 'a', section: 'body' });

      expect(focus.moveRow(-1)).toBe(true);
      expect(focus.focused.get()?.section).toBe('header');
      expect(at(focus)).toBe('instance-1//a');
    });

    it('stops above the first instance header, which is the real top', () => {
      const { focus } = setup();
      focus.focusFirst();

      // Up out of the first row is into the header, not refused.
      expect(focus.moveRow(-1)).toBe(true);
      expect(focus.focused.get()?.section).toBe('header');

      // Above that there is nothing.
      expect(focus.moveRow(-1)).toBe(false);
    });

    it('stops at the very end', () => {
      const { focus } = setup();
      focus.focus({ instanceId: 'instance-2', rowKey: 'r24', colId: 'a', section: 'body' });

      expect(focus.moveRow(1)).toBe(false);
    });
  });

  describe('columns', () => {
    it('moves across columns', () => {
      const { focus } = setup();
      focus.focusFirst();

      expect(focus.moveColumn(1)).toBe(true);
      expect(at(focus)).toBe('instance-0/r0/b');
    });

    it('carries into the next instance past the last column', () => {
      const { focus } = setup();
      focus.focus({ instanceId: 'instance-0', rowKey: 'r3', colId: 'c', section: 'body' });

      expect(focus.moveColumn(1)).toBe(true);
      // Same row, first column of the next instance.
      expect(at(focus)).toBe('instance-1/r13/a');
    });

    it('carries back into the previous instance before the first column', () => {
      const { focus } = setup();
      focus.focus({ instanceId: 'instance-1', rowKey: 'r13', colId: 'a', section: 'body' });

      expect(focus.moveColumn(-1)).toBe(true);
      expect(at(focus)).toBe('instance-0/r3/c');
    });

    it('stops at the first column of the first instance', () => {
      const { focus } = setup();
      focus.focusFirst();

      expect(focus.moveColumn(-1)).toBe(false);
    });

    it('clamps the row when the neighbouring instance is shorter', () => {
      // 25 rows: the third instance holds only 5.
      const { focus } = setup();
      focus.focus({ instanceId: 'instance-1', rowKey: 'r19', colId: 'c', section: 'body' });

      expect(focus.moveColumn(1)).toBe(true);
      expect(at(focus)).toBe('instance-2/r24/a');
    });
  });

  describe('instances', () => {
    it('jumps forward keeping row and column', () => {
      const { focus } = setup();
      focus.focus({ instanceId: 'instance-0', rowKey: 'r2', colId: 'b', section: 'body' });

      expect(focus.moveInstance(1)).toBe(true);
      expect(at(focus)).toBe('instance-1/r12/b');
    });

    it('stops at the last instance', () => {
      const { focus } = setup();
      focus.focus({ instanceId: 'instance-2', rowKey: 'r20', colId: 'a', section: 'body' });

      expect(focus.moveInstance(1)).toBe(false);
    });

    it('clamps into a shorter instance', () => {
      const { focus } = setup();
      focus.focus({ instanceId: 'instance-1', rowKey: 'r19', colId: 'a', section: 'body' });

      expect(focus.moveInstance(1)).toBe(true);
      expect(at(focus)).toBe('instance-2/r24/a');
    });
  });

  describe('edges', () => {
    it('moves to the start and end of a row', () => {
      const { focus } = setup();
      focus.focus({ instanceId: 'instance-1', rowKey: 'r12', colId: 'b', section: 'body' });

      focus.moveToEdge('rowEnd');
      expect(at(focus)).toBe('instance-1/r12/c');

      focus.moveToEdge('rowStart');
      expect(at(focus)).toBe('instance-1/r12/a');
    });

    it('moves to the very start and very end of the grid', () => {
      const { focus } = setup();
      focus.focus({ instanceId: 'instance-1', rowKey: 'r12', colId: 'b', section: 'body' });

      focus.moveToEdge('instanceEnd');
      expect(at(focus)).toBe('instance-2/r24/b');

      focus.moveToEdge('instanceStart');
      expect(at(focus)).toBe('instance-0/r0/b');
    });
  });

  describe('staleness', () => {
    it('refuses to move from a position that no longer exists', () => {
      // A filter or a collapse can remove the focused row from under the user.
      const { focus } = setup();
      focus.focus({ instanceId: 'instance-9', rowKey: 'gone', colId: 'a', section: 'body' });

      expect(focus.moveRow(1)).toBe(false);
    });
  });

  it('reports which cell is focused', () => {
    const { focus } = setup();
    focus.focusFirst();

    expect(focus.isFocused('instance-0', 'r0', 'a')).toBe(true);
    expect(focus.isFocused('instance-0', 'r0', 'b')).toBe(false);
    expect(focus.isFocused('instance-1', 'r0', 'a')).toBe(false);
  });

  it('clears', () => {
    const { focus } = setup();
    focus.focusFirst();

    focus.clear();

    expect(focus.focused.get()).toBeNull();
  });
});
