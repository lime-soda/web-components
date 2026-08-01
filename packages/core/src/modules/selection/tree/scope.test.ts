import { describe, expect, it, vi } from 'vitest';
import { resolveColumns } from '../../../columns/resolve-columns.js';
import { GridPipeline } from '../../../pipeline/grid-pipeline.js';
import { FilterModule } from '../../filter/filter-module.js';
import { ModuleRegistry } from '../../module-registry.js';
import { TreeModule } from '../../tree/tree-module.js';
import { SelectionModule } from '../selection-module.js';
import { TreeSelectionModule, type TreeSelectionScope } from './tree-selection-module.js';

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

const setup = (scope: TreeSelectionScope) => {
  const pipeline = new GridPipeline<Bond>({ getRowId: (d) => d.id });
  pipeline.store.setRowData(data);

  const selection = new SelectionModule<Bond>();
  const group = new TreeSelectionModule<Bond>({
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

const selectGroup = (scope: TreeSelectionScope) => {
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
    registry.register(new TreeSelectionModule<Bond>());
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
      registry.register(new TreeSelectionModule<Bond>({ scope: 'children' }));
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
        new TreeSelectionModule<Bond>({ scope: 'children', getParentId: (b) => b.parentId }),
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

  describe('collapsed is not filtered', () => {
    /**
     * A collapsed group's children are absent from the projection but were
     * never excluded by anything. Reading membership off the screen conflated
     * the two: a group collapsed before it had ever been opened stood only for
     * itself, so clicking it reported the category's own id as an instrument.
     */

    const build = (withHierarchy: boolean) => {
      const pipeline = new GridPipeline<Bond>({ getRowId: (d) => d.id });
      pipeline.store.setRowData(data);
      const selection = new SelectionModule<Bond>();
      const filter = new FilterModule<Bond>();
      const registry = new ModuleRegistry<Bond>({
        pipeline,
        getColumns: () => resolveColumns<Bond>([{ field: 'name' }]),
        dispatch: vi.fn(),
      });
      // Never expanded: nothing has ever seen what is inside.
      registry.register(
        new TreeModule<Bond>({ getParentId: (d) => d.parentId, defaultExpanded: false }),
      );
      registry.register(selection);
      registry.register(
        new TreeSelectionModule<Bond>(
          withHierarchy ? { getParentId: (bond) => bond.parentId } : {},
        ),
      );
      registry.register(filter);
      registry.start();
      pipeline.projector.rows.get();
      return { selection, filter, pipeline };
    };

    it('selects the instruments of a group never opened', () => {
      const { selection } = build(true);

      selection.setRowSelected('g', true);

      expect([...selection.getSelectedRows()].sort()).toEqual([
        'drop-1',
        'drop-2',
        'keep-1',
        'keep-2',
      ]);
    });

    it('still respects the filter while collapsed', () => {
      const { selection, filter, pipeline } = build(true);
      hideSome(filter, pipeline);

      selection.setRowSelected('g', true);

      // Hidden by the filter stays out; hidden by the collapse does not.
      expect([...selection.getSelectedRows()].sort()).toEqual(['keep-1', 'keep-2']);
    });

    it('reports the group as checked, not as its own instrument', () => {
      const { selection } = build(true);

      selection.setRowSelected('g', true);

      expect(selection.getRowState('g')).toBe('checked');
      expect(selection.getSelectedRows()).not.toContain('g');
    });

    it('falls back to naming the group without a hierarchy to read', () => {
      // Unchanged behaviour when the consumer supplies nothing: the projection
      // genuinely does not contain the children, so there is nothing to name.
      const { selection } = build(false);

      selection.setRowSelected('g', true);

      expect(selection.getSelectedRows()).toEqual(['g']);
    });
  });

  describe('more than two levels', () => {
    /**
     * `getParentId` names one link, and the module walks the chain — so depth
     * is not something it has to be told about.
     */
    interface Node {
      id: string;
      parentId: string | null;
      name: string;
    }

    // region → country → instrument
    const deep: Node[] = [
      { id: 'europe', parentId: null, name: 'Europe' },
      { id: 'uk', parentId: 'europe', name: 'UK' },
      { id: 'uk-1', parentId: 'uk', name: 'UKT 2030' },
      { id: 'uk-2', parentId: 'uk', name: 'UKT 2041' },
      { id: 'de', parentId: 'europe', name: 'Germany' },
      { id: 'de-1', parentId: 'de', name: 'DBR 2032' },
      { id: 'asia', parentId: null, name: 'Asia' },
      { id: 'jp', parentId: 'asia', name: 'Japan' },
      { id: 'jp-1', parentId: 'jp', name: 'JGB 2035' },
    ];

    const build = (scope: TreeSelectionScope = 'filteredChildren') => {
      const pipeline = new GridPipeline<Node>({ getRowId: (d) => d.id });
      pipeline.store.setRowData(deep);
      const selection = new SelectionModule<Node>();
      const registry = new ModuleRegistry<Node>({
        pipeline,
        getColumns: () => resolveColumns<Node>([{ field: 'name' }]),
        dispatch: vi.fn(),
      });
      registry.register(
        new TreeModule<Node>({ getParentId: (d) => d.parentId, defaultExpanded: true }),
      );
      registry.register(selection);
      registry.register(
        new TreeSelectionModule<Node>({ scope, getParentId: (node) => node.parentId }),
      );
      registry.start();
      pipeline.projector.rows.get();
      return { selection, pipeline };
    };

    it('selects every leaf beneath a top-level row, two levels down', () => {
      const { selection } = build();

      selection.setRowSelected('europe', true);

      // The leaves, not the countries in between.
      expect([...selection.getSelectedRows()].sort()).toEqual(['de-1', 'uk-1', 'uk-2']);
    });

    it('selects a middle level without reaching its siblings', () => {
      const { selection } = build();

      selection.setRowSelected('uk', true);

      expect([...selection.getSelectedRows()].sort()).toEqual(['uk-1', 'uk-2']);
    });

    it('reports every level above a leaf as indeterminate', () => {
      const { selection } = build();

      selection.setRowSelected('uk-1', true);

      expect(selection.getRowState('uk')).toBe('indeterminate');
      expect(selection.getRowState('europe')).toBe('indeterminate');
      expect(selection.getRowState('asia')).toBe('unchecked');
    });

    it('completes the chain when the last leaf is selected', () => {
      const { selection } = build();

      selection.setRowSelected('uk-1', true);
      selection.setRowSelected('uk-2', true);

      expect(selection.getRowState('uk')).toBe('checked');
      expect(selection.getRowState('europe')).toBe('indeterminate');
    });

    it('withdraws through two levels when a leaf is deselected', () => {
      const { selection } = build();
      selection.setRowSelected('europe', true);

      selection.setRowSelected('uk-1', false);

      expect([...selection.getSelectedRows()].sort()).toEqual(['de-1', 'uk-2']);
    });
  });
});
