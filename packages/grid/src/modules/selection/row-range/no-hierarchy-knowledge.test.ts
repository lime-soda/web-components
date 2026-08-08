import { describe, expect, it, vi } from 'vite-plus/test';
import { resolveColumns } from '../../../columns/resolve-columns.js';
import { GridPipeline } from '../../../pipeline/grid-pipeline.js';
import { ModuleRegistry } from '../../module-registry.js';
import type { SelectionMembership } from '../membership.js';
import { SelectionModule } from '../selection-module.js';
import { RowRangeModule } from './row-range-module.js';

/**
 * The range module knows nothing about hierarchy.
 *
 * It used to read `meta.depth` to work out whether a row's children were on
 * screen — inferring a hierarchy from a convention the tree module owns, which
 * would quietly misbehave under any module that expressed one differently. It
 * asks selection what a row stands for instead.
 *
 * This test supplies a membership with no depth, no parent ids and no tree
 * module at all: just an arbitrary mapping. The spans still come out right.
 */

interface Row {
  id: string;
  name: string;
}

/** 'box' stands for r1 and r2. Nothing in the data says so. */
const membership: SelectionMembership = {
  leavesOf: (rowId) => (rowId === 'box' ? ['r1', 'r2'] : [rowId]),
  allLeaves: () => ['r0', 'r1', 'r2', 'r3'],
  covers: (rowId, selected) => selected.has(rowId),
  withdraw: () => {},
};

const setup = (rowIds: string[]) => {
  const pipeline = new GridPipeline<Row>({ getRowId: (d) => d.id });
  pipeline.store.setRowData(rowIds.map((id) => ({ id, name: id })));

  const selection = new SelectionModule<Row>();
  const range = new RowRangeModule<Row>();
  const provider = {
    id: 'arbitrary-membership',
    dependsOn: ['selection'],
    init: () => {},
    provideSelectionMembership: () => membership,
  };
  const registry = new ModuleRegistry<Row>({
    pipeline,
    getColumns: () => resolveColumns<Row>([{ field: 'name' }]),
    dispatch: vi.fn(),
  });
  registry.register(selection);
  registry.register(provider as never);
  registry.register(range);
  registry.start();
  pipeline.projector.rows.get();
  return { selection, range };
};

describe('a span under a hierarchy it has never seen', () => {
  it('drops a row whose rows are on screen, keeping those instead', () => {
    const { selection, range } = setup(['r0', 'box', 'r1', 'r2', 'r3']);
    selection.setRowSelected('r0', true);

    range.selectRange('r2');

    // 'box' stands for r1 and r2, both projected, so it adds nothing.
    expect([...selection.getSelectedRows()].sort()).toEqual(['r0', 'r1', 'r2']);
  });

  it('keeps a row whose rows are not on screen, since nothing else can stand for them', () => {
    const { selection, range } = setup(['r0', 'box', 'r3']);
    selection.setRowSelected('r0', true);

    range.selectRange('box');

    expect([...selection.getSelectedRows()].sort()).toEqual(['r0', 'r1', 'r2']);
  });

  it('is unaffected with no membership provider at all', () => {
    const pipeline = new GridPipeline<Row>({ getRowId: (d) => d.id });
    pipeline.store.setRowData(['r0', 'r1', 'r2'].map((id) => ({ id, name: id })));
    const selection = new SelectionModule<Row>();
    const registry = new ModuleRegistry<Row>({
      pipeline,
      getColumns: () => resolveColumns<Row>([{ field: 'name' }]),
      dispatch: vi.fn(),
    });
    registry.register(selection);
    registry.register(new RowRangeModule<Row>());
    registry.start();
    pipeline.projector.rows.get();

    selection.setRowSelected('r0', true);
    registry.get<RowRangeModule<Row>>('selection-row-range')!.selectRange('r2');

    expect([...selection.getSelectedRows()].sort()).toEqual(['r0', 'r1', 'r2']);
  });
});
