import { describe, expect, it, vi } from 'vitest';
import { resolveColumns } from '../../../columns/resolve-columns.js';
import { GridPipeline } from '../../../pipeline/grid-pipeline.js';
import { ModuleRegistry } from '../../module-registry.js';
import type { ModuleContext } from '../../types.js';
import { TreeModule } from '../../tree/tree-module.js';
import { SelectionModule } from '../selection-module.js';
import { TreeSelectionModule } from './tree-selection-module.js';

/**
 * The seam between flat selection and hierarchy.
 *
 * Core selection is flat by construction: it holds ids and every row stands for
 * itself. Everything a group implies — leaves, indeterminate state, coverage of
 * a collapsed group — arrives with this module and leaves with it.
 */

interface Bond {
  id: string;
  parentId: string | null;
  name: string;
}

const data: Bond[] = [
  { id: 'g', parentId: null, name: 'Gilts' },
  { id: 'a', parentId: 'g', name: 'A' },
  { id: 'b', parentId: 'g', name: 'B' },
];

const setup = (withGroup: boolean) => {
  const pipeline = new GridPipeline<Bond>({ getRowId: (d) => d.id });
  pipeline.store.setRowData(data);
  const selection = new SelectionModule<Bond>();
  const group = new TreeSelectionModule<Bond>({ getParentId: (bond) => bond.parentId });
  const registry = new ModuleRegistry<Bond>({
    pipeline,
    getColumns: () => resolveColumns<Bond>([{ field: 'name' }]),
    dispatch: vi.fn(),
  });
  registry.register(
    new TreeModule<Bond>({ getParentId: (d) => d.parentId, defaultExpanded: true }),
  );
  registry.register(selection);
  if (withGroup) registry.register(group);
  registry.start();
  pipeline.projector.rows.get();
  return { selection, group, registry, pipeline };
};

describe('selection without the group module', () => {
  it('selects the group row alone, standing for nothing else', () => {
    const { selection } = setup(false);

    selection.setRowSelected('g', true);

    expect(selection.getSelectedRows()).toEqual(['g']);
  });

  it('never reports indeterminate, because a flat row cannot be partly selected', () => {
    const { selection } = setup(false);

    selection.setRowSelected('a', true);

    expect(selection.getRowState('g')).toBe('unchecked');
    expect(selection.getRowState('a')).toBe('checked');
  });

  it('counts the group as one of the rows select-all reaches', () => {
    const { selection } = setup(false);

    selection.selectAll();

    expect([...selection.getSelectedRows()].sort()).toEqual(['a', 'b', 'g']);
  });
});

describe('selection with the group module', () => {
  it('makes the group stand for its children', () => {
    const { selection } = setup(true);

    selection.setRowSelected('g', true);

    expect([...selection.getSelectedRows()].sort()).toEqual(['a', 'b']);
  });

  it('reports a partly selected group as indeterminate', () => {
    const { selection } = setup(true);

    selection.setRowSelected('a', true);

    expect(selection.getRowState('g')).toBe('indeterminate');
  });

  it('leaves the headings out of select-all', () => {
    const { selection } = setup(true);

    selection.selectAll();

    expect([...selection.getSelectedRows()].sort()).toEqual(['a', 'b']);
  });

  it('declares its dependency, so the registry can order and check it', () => {
    const group = new TreeSelectionModule<Bond>({ getParentId: (bond) => bond.parentId });

    expect(group.dependsOn).toEqual(['selection']);
  });

  it('refuses to start without the module it depends on', () => {
    const pipeline = new GridPipeline<Bond>({ getRowId: (d) => d.id });
    const registry = new ModuleRegistry<Bond>({
      pipeline,
      getColumns: () => resolveColumns<Bond>([{ field: 'name' }]),
      dispatch: vi.fn(),
    });
    registry.register(new TreeSelectionModule<Bond>({ getParentId: (bond) => bond.parentId }));

    expect(() => registry.start()).toThrow(/selection/);
  });

  it('restores flat membership when it is torn down', () => {
    const { selection, registry } = setup(true);
    selection.setRowSelected('g', true);
    expect([...selection.getSelectedRows()].sort()).toEqual(['a', 'b']);

    registry.destroy();
    selection.clearSelection();
    selection.setRowSelected('g', true);

    // Back to the group standing only for itself.
    expect(selection.getSelectedRows()).toEqual(['g']);
  });

  describe('the exclusive seams', () => {
    /**
     * Two modules with different ideas of what a row id stands for are not
     * composable — one of them is simply wrong about every row. The grid says
     * so at registration rather than behaving like whichever registered last.
     */
    const claimant = (id: string) => ({
      id,
      dependsOn: ['selection'],
      init(context: ModuleContext<Bond>) {
        const selection = context.getModule<SelectionModule<Bond>>('selection')!;
        context.addTeardown(
          selection.claimMembership(id, {
            leavesOf: (rowId) => [rowId],
            allLeaves: () => [],
            covers: (rowId, selected) => selected.has(rowId),
            withdraw: () => {},
          }),
        );
      },
    });

    it('refuses a second claim on membership', () => {
      const { registry } = setup(true);

      expect(() => registry.register(claimant('impostor'))).toThrow(
        /already claimed by "selection-tree"/,
      );
    });

    it('names both modules, so the clash can be acted on', () => {
      const { registry } = setup(true);

      expect(() => registry.register(claimant('impostor'))).toThrow(/"impostor"/);
    });

    it('lets the holder re-claim what it already has', () => {
      const { selection } = setup(true);

      expect(() =>
        selection.claimMembership('selection-tree', {
          leavesOf: (rowId) => [rowId],
          allLeaves: () => [],
          covers: (rowId, held) => held.has(rowId),
          withdraw: () => {},
        }),
      ).not.toThrow();
    });

    it('frees the claim when the holder releases it', () => {
      const { selection } = setup(true);
      const release = selection.claimMembership('selection-tree', {
        leavesOf: (rowId) => [rowId],
        allLeaves: () => [],
        covers: (rowId, held) => held.has(rowId),
        withdraw: () => {},
      });

      release();

      expect(() =>
        selection.claimMembership('somebody-else', {
          leavesOf: (rowId) => [rowId],
          allLeaves: () => [],
          covers: (rowId, held) => held.has(rowId),
          withdraw: () => {},
        }),
      ).not.toThrow();
    });

    it('refuses a second claim on range handling too', () => {
      const { selection } = setup(true);
      selection.claimRangeHandler('first', () => {});

      expect(() => selection.claimRangeHandler('second', () => {})).toThrow(
        /selection range handling/,
      );
    });
  });
});
