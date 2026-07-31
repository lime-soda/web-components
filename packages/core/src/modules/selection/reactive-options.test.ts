import { describe, expect, it } from 'vitest';
import { resolveColumns } from '../../columns/resolve-columns.js';
import { GridPipeline } from '../../pipeline/grid-pipeline.js';
import { ModuleRegistry } from '../module-registry.js';
import { TreeModule } from '../tree/tree-module.js';
import { SelectionModule } from './selection-module.js';
import { GroupSelectionModule } from './group/group-selection-module.js';

/**
 * Module options are reactive.
 *
 * The grid's own options flow through a signal, but a module's are handed to its
 * constructor and reassigning `modules` re-registers nothing — so without this a
 * preference toggle could only be applied by rebuilding the whole grid.
 */

interface Row {
  id: string;
  parentId: string | null;
  name: string;
}

const data: Row[] = [
  { id: 'g', parentId: null, name: 'Group' },
  { id: 'a', parentId: 'g', name: 'A' },
  { id: 'b', parentId: 'g', name: 'B' },
];

const setup = (options: Record<string, unknown> = {}) => {
  const { groupSelectsChildren, ...selectionOptions } = options as {
    groupSelectsChildren?: boolean;
  };
  const pipeline = new GridPipeline<Row>({ getRowId: (d) => d.id });
  pipeline.store.setRowData(data);
  const selection = new SelectionModule<Row>(selectionOptions);
  const group = new GroupSelectionModule<Row>(
    groupSelectsChildren === undefined
      ? {}
      : { scope: groupSelectsChildren ? ('filteredChildren' as const) : ('self' as const) },
  );
  const tree = new TreeModule<Row>({ getParentId: (d) => d.parentId, defaultExpanded: true });
  const registry = new ModuleRegistry<Row>({
    pipeline,
    getColumns: () => resolveColumns<Row>([{ field: 'name' }]),
    dispatch: () => {},
  });
  registry.register(tree);
  registry.register(selection);
  registry.register(group);
  registry.start();
  pipeline.projector.rows.get();
  return { selection, group, pipeline, registry };
};

describe('module options are reactive', () => {
  it('switches a group from standing for its children to standing alone', () => {
    const { selection, group } = setup();
    selection.setRowSelected('g', true);
    expect(selection.getSelectedRows()).toEqual(['a', 'b']);

    group.setOptions({ scope: 'self' });
    selection.clearSelection();
    selection.setRowSelected('g', true);

    expect(selection.getSelectedRows()).toEqual(['g']);
    expect(selection.getRowState('a')).toBe('unchecked');
  });

  it('switches back again', () => {
    const { selection, group } = setup({ groupSelectsChildren: false });
    selection.setRowSelected('g', true);
    expect(selection.getSelectedRows()).toEqual(['g']);

    group.setOptions({ scope: 'filteredChildren' });
    selection.clearSelection();
    selection.setRowSelected('g', true);

    expect(selection.getSelectedRows()).toEqual(['a', 'b']);
  });

  it('rebuilds the leaf index, which is derived from the options', () => {
    // The index is cached against the projection, and a mode change does not
    // alter the projection — so a stale index would keep answering with the old
    // mode's leaves. Checked through the group, since rows selected before the
    // switch are legitimately still selected after it.
    const { selection, group } = setup();

    group.setOptions({ scope: 'self' });

    expect(selection.getRowState('g')).toBe('unchecked');
    selection.setRowSelected('g', true);
    expect(selection.getSelectedRows()).toEqual(['g']);
  });

  it('leaves rows selected before the switch selected after it', () => {
    // A mode change is not a deselection.
    const { selection, group } = setup();
    selection.setRowSelected('a', true);

    group.setOptions({ scope: 'self' });

    expect(selection.getRowState('a')).toBe('checked');
  });

  it('adds and removes its contributed column', () => {
    const { selection, registry } = setup();
    expect(registry.provideColumns().map((c) => c.colId)).toEqual(['flow-selection']);

    selection.setOptions({ checkboxColumn: false });

    expect(registry.provideColumns()).toEqual([]);
  });

  it('applies a changed mode to later selections', () => {
    const { selection, group } = setup({ mode: 'multi' });
    selection.setRowSelected('a', true);
    selection.setRowSelected('b', true);
    expect(selection.getSelectedCount()).toBe(2);

    selection.setOptions({ mode: 'single' });
    selection.clearSelection();
    selection.setRowSelected('a', true);
    selection.setRowSelected('b', true);

    expect(selection.getSelectedRows()).toEqual(['b']);
  });
});
