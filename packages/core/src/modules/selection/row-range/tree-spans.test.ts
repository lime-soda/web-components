import { describe, expect, it, vi } from 'vitest';
import { resolveColumns } from '../../../columns/resolve-columns.js';
import { GridPipeline } from '../../../pipeline/grid-pipeline.js';
import { ModuleRegistry } from '../../module-registry.js';
import { TreeModule } from '../../tree/tree-module.js';
import { TreeSelectionModule } from '../tree/tree-selection-module.js';
import { SelectionModule } from '../selection-module.js';
import { RowRangeModule } from './row-range-module.js';

/**
 * What a span means when it meets a group.
 *
 * A span used to hand every row it covered to selection, which expands a group
 * row to all of its children — so clipping the corner of a group selected the
 * whole thing. A range covers rows; only a group that is *entirely* covered, or
 * one whose contents are hidden behind it, stands for its children.
 */

interface Bond {
  id: string;
  parentId: string | null;
  name: string;
}

/** Two groups of four. */
const data: Bond[] = [
  { id: 'g0', parentId: null, name: 'Gilts' },
  ...Array.from({ length: 4 }, (_, i) => ({ id: `g0-i${i}`, parentId: 'g0', name: `A${i}` })),
  { id: 'g1', parentId: null, name: 'Bunds' },
  ...Array.from({ length: 4 }, (_, i) => ({ id: `g1-i${i}`, parentId: 'g1', name: `B${i}` })),
];

const setup = (expanded = true) => {
  const pipeline = new GridPipeline<Bond>({ getRowId: (d) => d.id });
  pipeline.store.setRowData(data);

  const selection = new SelectionModule<Bond>();
  const range = new RowRangeModule<Bond>();
  const tree = new TreeModule<Bond>({
    getParentId: (bond) => bond.parentId,
    defaultExpanded: expanded,
  });
  const registry = new ModuleRegistry<Bond>({
    pipeline,
    getColumns: () => resolveColumns<Bond>([{ field: 'name' }]),
    dispatch: vi.fn(),
  });
  registry.register(tree);
  registry.register(selection);
  registry.register(new TreeSelectionModule<Bond>());
  registry.register(range);
  registry.start();
  pipeline.projector.rows.get();

  return { selection, range, tree, pipeline };
};

const spanFrom = (from: string, to: string, expanded = true) => {
  const { selection, range } = setup(expanded);
  selection.setRowSelected(from, true);
  range.selectRange(to);
  return [...selection.getSelectedRows()].sort();
};

describe('a span meeting a group', () => {
  it('selects only the rows it crossed when it clips a group', () => {
    // From the third instrument of g0 to the second of g1: the g1 heading is in
    // the span, but only two of its four children are.
    expect(spanFrom('g0-i2', 'g1-i1')).toEqual(['g0-i2', 'g0-i3', 'g1-i0', 'g1-i1']);
  });

  it('selects the whole group when the span covers all of it', () => {
    expect(spanFrom('g0-i3', 'g1-i3')).toEqual(['g0-i3', 'g1-i0', 'g1-i1', 'g1-i2', 'g1-i3']);
  });

  it('agrees with selecting the group row directly when it covers the group', () => {
    const bySpan = spanFrom('g1-i0', 'g1-i3');

    const { selection } = setup();
    selection.setRowSelected('g1', true);

    expect(bySpan).toEqual([...selection.getSelectedRows()].sort());
  });

  it('reaches nothing extra when the span ends on a heading', () => {
    // The heading's children start past the end of the span, so it stands for
    // none of them.
    expect(spanFrom('g0-i1', 'g1')).toEqual(['g0-i1', 'g0-i2', 'g0-i3']);
  });

  it('takes the contents of a collapsed group, once those are known', () => {
    // Collapsed after being seen open, so the membership was learned. A span
    // over the headings means everything beneath them.
    const { selection, range, tree, pipeline } = setup();
    tree.collapseAll();
    pipeline.projector.rows.get();

    selection.setRowSelected('g0', true);
    range.selectRange('g1');

    expect([...selection.getSelectedRows()].sort()).toEqual([
      'g0-i0',
      'g0-i1',
      'g0-i2',
      'g0-i3',
      'g1-i0',
      'g1-i1',
      'g1-i2',
      'g1-i3',
    ]);
  });

  it('names the group itself when its contents have never been seen', () => {
    // Nothing else can stand for them: the children have never been projected,
    // so the heading is the most specific answer there is.
    expect(spanFrom('g0', 'g1', false)).toEqual(['g0', 'g1']);
  });

  it('leaves the group indeterminate after a partial span', () => {
    const { selection, range } = setup();
    selection.setRowSelected('g1-i0', true);
    range.selectRange('g1-i1');

    expect(selection.getRowState('g1')).toBe('indeterminate');
  });

  it('shrinks back out of a group without stranding its rows', () => {
    const { selection, range } = setup();
    selection.setRowSelected('g0-i2', true);

    range.selectRange('g1-i2');
    range.selectRange('g0-i3');

    expect([...selection.getSelectedRows()].sort()).toEqual(['g0-i2', 'g0-i3']);
  });

  it('is unaffected with no hierarchy, where every row is its own', () => {
    const pipeline = new GridPipeline<Bond>({ getRowId: (d) => d.id });
    pipeline.store.setRowData(data);
    const selection = new SelectionModule<Bond>();
    const range = new RowRangeModule<Bond>();
    const registry = new ModuleRegistry<Bond>({
      pipeline,
      getColumns: () => resolveColumns<Bond>([{ field: 'name' }]),
      dispatch: vi.fn(),
    });
    registry.register(selection);
    registry.register(range);
    registry.start();
    pipeline.projector.rows.get();

    selection.setRowSelected('g0-i2', true);
    range.selectRange('g1');

    // Flat: the rows between, headings included, exactly as they are listed.
    expect([...selection.getSelectedRows()].sort()).toEqual(['g0-i2', 'g0-i3', 'g1']);
  });
});
