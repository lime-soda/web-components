import { describe, expect, it, vi } from 'vitest';
import { resolveColumns } from '../../../columns/resolve-columns.js';
import { GridPipeline } from '../../../pipeline/grid-pipeline.js';
import { ModuleRegistry } from '../../module-registry.js';
import { SelectionModule, type SelectionModuleOptions } from '../selection-module.js';
import { RowRangeModule } from './row-range-module.js';

/**
 * Shift-click spans, which core selection deliberately cannot do on its own.
 */

interface Row {
  id: string;
  name: string;
}

const rows = (count: number): Row[] =>
  Array.from({ length: count }, (_, index) => ({ id: `r${index}`, name: `R${index}` }));

const setup = (count = 5, options: SelectionModuleOptions = {}, withRange = true) => {
  const dispatch = vi.fn();
  const pipeline = new GridPipeline<Row>({ getRowId: (d) => d.id });
  pipeline.store.setRowData(rows(count));
  const selection = new SelectionModule<Row>(options);
  const range = new RowRangeModule<Row>();
  const registry = new ModuleRegistry<Row>({
    pipeline,
    getColumns: () => resolveColumns<Row>([{ field: 'name' }]),
    dispatch,
  });
  registry.register(selection);
  if (withRange) registry.register(range);
  registry.start();
  pipeline.projector.rows.get();
  return { selection, range, pipeline, registry, dispatch };
};

/** Shift-clicking the row's checkbox, the other way into a range. */
const shiftClickCheckbox = (selection: SelectionModule<Row>, rowId: string) => {
  selection.handleCheckbox(rowId, true, true);
};

const shiftClickRow = (selection: SelectionModule<Row>, rowId: string) => {
  selection
    .rowDecorator({ row: { id: rowId, rowId }, node: undefined } as never)
    ?.onActivate?.({ shiftKey: true, ctrlKey: false, metaKey: false } as unknown as Event);
};

describe('RowRangeModule', () => {
  it('selects the span between the anchor and the target', () => {
    const { selection, range } = setup();
    selection.setRowSelected('r1', true);

    range.selectRange('r3');

    expect(selection.getSelectedRows()).toEqual(['r1', 'r2', 'r3']);
  });

  it('works backwards', () => {
    const { selection, range } = setup();
    selection.setRowSelected('r3', true);

    range.selectRange('r1');

    expect([...selection.getSelectedRows()].sort()).toEqual(['r1', 'r2', 'r3']);
  });

  it('falls back to a single selection with no anchor', () => {
    const { selection, range } = setup(3);

    range.selectRange('r1');

    expect(selection.getSelectedRows()).toEqual(['r1']);
  });

  it('falls back when an end is missing from the projection', () => {
    const { selection, range } = setup(3);
    selection.setRowSelected('r0', true);

    range.selectRange('nowhere');

    expect(selection.getSelectedRows()).toEqual(['r0', 'nowhere']);
  });

  it('reports the whole span as one change', () => {
    // One event and one repaint for the span, not one per row.
    const { selection, dispatch } = setup();
    selection.setRowSelected('r0', true);
    dispatch.mockClear();

    selection.setRowsSelected(['r0', 'r1', 'r2', 'r3'], true);

    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('keeps the anchor so a second shift-click re-extends from it', () => {
    const { selection, range } = setup();
    selection.setRowSelected('r0', true);

    range.selectRange('r4');
    expect(selection.getSelectedCount()).toBe(5);

    // Re-extending has to measure from r0, not from r4.
    selection.clearSelection();
    selection.setRowSelected('r0', true);
    range.selectRange('r2');

    expect(selection.getSelectedRows()).toEqual(['r0', 'r1', 'r2']);
  });

  describe('through a shift-click', () => {
    it('extends the selection', () => {
      const { selection } = setup(5, { clickToSelect: true });
      selection.setRowSelected('r1', true);

      shiftClickRow(selection, 'r3');

      expect(selection.getSelectedRows()).toEqual(['r1', 'r2', 'r3']);
    });

    it('is a plain click when the module is absent', () => {
      // Core selection has no notion of a span, so shift means nothing to it
      // and the click does what an unmodified one would.
      const { selection } = setup(5, { clickToSelect: true }, false);
      selection.setRowSelected('r1', true);

      shiftClickRow(selection, 'r3');

      expect(selection.getSelectedRows()).toEqual(['r3']);
    });
  });

  it('selects a single row in single mode, since a span cannot be shown', () => {
    const { selection, range } = setup(5, { mode: 'single' });
    selection.setRowSelected('r1', true);

    range.selectRange('r3');

    expect(selection.getSelectedRows()).toEqual(['r3']);
  });

  describe('re-cutting a span', () => {
    /**
     * Dragging back has to give up what the span no longer covers, and give up
     * only that: rows picked out separately are not the range's to withdraw.
     */

    it('shrinks when shift-clicking backwards inside the span', () => {
      const { selection, range } = setup(8);
      selection.setRowSelected('r1', true);

      range.selectRange('r6');
      range.selectRange('r3');

      expect([...selection.getSelectedRows()].sort()).toEqual(['r1', 'r2', 'r3']);
    });

    it('grows again after shrinking', () => {
      const { selection, range } = setup(8);
      selection.setRowSelected('r1', true);

      range.selectRange('r6');
      range.selectRange('r3');
      range.selectRange('r5');

      expect([...selection.getSelectedRows()].sort()).toEqual(['r1', 'r2', 'r3', 'r4', 'r5']);
    });

    it('flips to the other side of the anchor', () => {
      const { selection, range } = setup(8);
      selection.setRowSelected('r4', true);

      range.selectRange('r6');
      range.selectRange('r2');

      expect([...selection.getSelectedRows()].sort()).toEqual(['r2', 'r3', 'r4']);
    });

    it('leaves rows chosen separately alone', () => {
      // The flaw this fixes: a shift-click used to clear the whole selection,
      // so a row ticked earlier elsewhere disappeared.
      const { selection, range } = setup(8);
      selection.setRowSelected('r7', true); // kept aside
      selection.setRowSelected('r1', true); // becomes the anchor

      range.selectRange('r4');
      range.selectRange('r2');

      expect([...selection.getSelectedRows()].sort()).toEqual(['r1', 'r2', 'r7']);
    });

    it('starts a fresh span once the anchor moves', () => {
      const { selection, range } = setup(8);
      selection.setRowSelected('r1', true);
      range.selectRange('r4');

      // A new anchor: the old span is no longer the range's to withdraw.
      selection.setRowSelected('r6', true);
      range.selectRange('r7');

      expect([...selection.getSelectedRows()].sort()).toEqual(['r1', 'r2', 'r3', 'r4', 'r6', 'r7']);
    });
  });

  describe('a checkbox and a row behave the same', () => {
    const spanVia = (
      extend: (selection: SelectionModule<Row>, rowId: string) => void,
    ): readonly string[] => {
      const { selection } = setup(8, { clickToSelect: true });
      selection.setRowSelected('r1', true);
      extend(selection, 'r5');
      extend(selection, 'r3');
      return [...selection.getSelectedRows()].sort();
    };

    it('both re-cut the span on a backwards shift-click', () => {
      expect(spanVia(shiftClickCheckbox)).toEqual(['r1', 'r2', 'r3']);
      expect(spanVia(shiftClickRow)).toEqual(spanVia(shiftClickCheckbox));
    });

    it('a shift-click on a ticked checkbox still means the range', () => {
      const { selection } = setup(8);
      selection.setRowSelected('r1', true);
      selection.handleCheckbox('r4', true, true);
      expect(selection.getSelectedCount()).toBe(4);

      // r4 is already selected; shift-clicking it is still a span, not a toggle.
      selection.handleCheckbox('r4', false, true);

      expect([...selection.getSelectedRows()].sort()).toEqual(['r1', 'r2', 'r3', 'r4']);
    });
  });
});
