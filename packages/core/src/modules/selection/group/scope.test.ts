import { describe, expect, it, vi } from 'vitest';
import { resolveColumns } from '../../../columns/resolve-columns.js';
import { GridPipeline } from '../../../pipeline/grid-pipeline.js';
import { FilterModule } from '../../filter/filter-module.js';
import { ModuleRegistry } from '../../module-registry.js';
import { TreeModule } from '../../tree/tree-module.js';
import { SelectionModule } from '../selection-module.js';
import { GroupSelectionModule, type GroupSelectionScope } from './group-selection-module.js';

/**
 * What a group row stands for.
 *
 * The three scopes only genuinely differ under a filter: with everything
 * visible, `children` and `filteredChildren` agree by definition. So every test
 * here filters first.
 */

interface Bond {
  id: string;
  parentId: string | null;
  name: string;
}

const data: Bond[] = [
  { id: 'g', parentId: null, name: 'Gilts' },
  { id: 'keep-1', parentId: 'g', name: 'keep one' },
  { id: 'keep-2', parentId: 'g', name: 'keep two' },
  { id: 'drop-1', parentId: 'g', name: 'drop one' },
  { id: 'drop-2', parentId: 'g', name: 'drop two' },
];

const setup = (scope: GroupSelectionScope) => {
  const pipeline = new GridPipeline<Bond>({ getRowId: (d) => d.id });
  pipeline.store.setRowData(data);

  const selection = new SelectionModule<Bond>();
  const group = new GroupSelectionModule<Bond>({
    scope,
    getParentId: (bond) => bond.parentId,
  });
  const filter = new FilterModule<Bond>();
  const registry = new ModuleRegistry<Bond>({
    pipeline,
    getColumns: () => resolveColumns<Bond>([{ field: 'name' }]),
    dispatch: vi.fn(),
  });
  registry.register(
    new TreeModule<Bond>({ getParentId: (d) => d.parentId, defaultExpanded: true }),
  );
  registry.register(selection);
  registry.register(group);
  registry.register(filter);
  registry.start();
  pipeline.projector.rows.get();

  return { selection, group, filter, pipeline };
};

/** Hides the two 'drop' rows, leaving the group and its two 'keep' children. */
const hideSome = (filter: FilterModule<Bond>, pipeline: GridPipeline<Bond>) => {
  filter.setQuickFilter('keep');
  pipeline.projector.rows.get();
};

const selectGroup = (scope: GroupSelectionScope) => {
  const { selection, filter, pipeline } = setup(scope);
  hideSome(filter, pipeline);
  selection.setRowSelected('g', true);
  return [...selection.getSelectedRows()].sort();
};

describe('group selection scope', () => {
  it('selects the group alone with `self`', () => {
    expect(selectGroup('self')).toEqual(['g']);
  });

  it('selects only what survived the filter with `filteredChildren`', () => {
    expect(selectGroup('filteredChildren')).toEqual(['keep-1', 'keep-2']);
  });

  it('selects every child with `children`, filter or no filter', () => {
    expect(selectGroup('children')).toEqual(['drop-1', 'drop-2', 'keep-1', 'keep-2']);
  });

  it('defaults to `filteredChildren`, the scope that cannot select the unseen', () => {
    const pipeline = new GridPipeline<Bond>({ getRowId: (d) => d.id });
    pipeline.store.setRowData(data);
    const selection = new SelectionModule<Bond>();
    const filter = new FilterModule<Bond>();
    const registry = new ModuleRegistry<Bond>({
      pipeline,
      getColumns: () => resolveColumns<Bond>([{ field: 'name' }]),
      dispatch: vi.fn(),
    });
    registry.register(
      new TreeModule<Bond>({ getParentId: (d) => d.parentId, defaultExpanded: true }),
    );
    registry.register(selection);
    registry.register(new GroupSelectionModule<Bond>());
    registry.register(filter);
    registry.start();
    pipeline.projector.rows.get();

    hideSome(filter, pipeline);
    selection.setRowSelected('g', true);

    expect([...selection.getSelectedRows()].sort()).toEqual(['keep-1', 'keep-2']);
  });

  describe('with `children`', () => {
    it('reports the group checked once every child is, including hidden ones', () => {
      const { selection, filter, pipeline } = setup('children');
      hideSome(filter, pipeline);

      selection.setRowSelected('g', true);

      expect(selection.getRowState('g')).toBe('checked');
    });

    it('reports indeterminate while only the visible ones are selected', () => {
      const { selection, filter, pipeline } = setup('children');
      hideSome(filter, pipeline);

      selection.setRowSelected('keep-1', true);
      selection.setRowSelected('keep-2', true);

      // Two of four: the hidden pair still count.
      expect(selection.getRowState('g')).toBe('indeterminate');
    });

    it('covers a hidden row through its selected ancestor', () => {
      const { selection, filter, pipeline } = setup('children');
      hideSome(filter, pipeline);

      selection.setRowSelected('g', true);
      selection.setRowSelected('keep-1', false);

      // Deselecting one visible child leaves the rest, hidden ones included.
      expect([...selection.getSelectedRows()].sort()).toEqual(['drop-1', 'drop-2', 'keep-2']);
    });

    it('selects nothing beyond the row itself without getParentId', () => {
      // The hierarchy comes from the consumer; with no way to read it, a group
      // can only stand for itself.
      const pipeline = new GridPipeline<Bond>({ getRowId: (d) => d.id });
      pipeline.store.setRowData(data);
      const selection = new SelectionModule<Bond>();
      const registry = new ModuleRegistry<Bond>({
        pipeline,
        getColumns: () => resolveColumns<Bond>([{ field: 'name' }]),
        dispatch: vi.fn(),
      });
      registry.register(
        new TreeModule<Bond>({ getParentId: (d) => d.parentId, defaultExpanded: true }),
      );
      registry.register(selection);
      registry.register(new GroupSelectionModule<Bond>({ scope: 'children' }));
      registry.start();
      pipeline.projector.rows.get();

      selection.setRowSelected('g', true);

      expect(selection.getSelectedRows()).toEqual(['g']);
    });

    it('survives a cycle in the supplied parents', () => {
      const pipeline = new GridPipeline<Bond>({ getRowId: (d) => d.id });
      pipeline.store.setRowData([
        { id: 'a', parentId: 'b', name: 'A' },
        { id: 'b', parentId: 'a', name: 'B' },
      ]);
      const selection = new SelectionModule<Bond>();
      const registry = new ModuleRegistry<Bond>({
        pipeline,
        getColumns: () => resolveColumns<Bond>([{ field: 'name' }]),
        dispatch: vi.fn(),
      });
      registry.register(selection);
      registry.register(
        new GroupSelectionModule<Bond>({ scope: 'children', getParentId: (b) => b.parentId }),
      );
      registry.start();
      pipeline.projector.rows.get();

      expect(() => selection.setRowSelected('a', true)).not.toThrow();
    });
  });

  it('changes scope at runtime', () => {
    const { selection, group, filter, pipeline } = setup('filteredChildren');
    hideSome(filter, pipeline);
    selection.setRowSelected('g', true);
    expect([...selection.getSelectedRows()].sort()).toEqual(['keep-1', 'keep-2']);

    group.setOptions({ scope: 'children' });
    selection.clearSelection();
    selection.setRowSelected('g', true);

    expect([...selection.getSelectedRows()].sort()).toEqual([
      'drop-1',
      'drop-2',
      'keep-1',
      'keep-2',
    ]);
  });
});
