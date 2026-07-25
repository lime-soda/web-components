import { beforeEach, describe, expect, it } from 'vitest';
import { FlowLayoutEngine } from '../../layout/flow-layout-engine.js';
import type { DisplayRow, ViewportMetrics } from '../../layout/types.js';
import { GridPipeline } from '../../pipeline/grid-pipeline.js';
import { ModuleRegistry } from '../module-registry.js';
import { TreeModule, type TreeModuleOptions } from './tree-module.js';

interface Bond {
  id: string;
  parentId: string | null;
  instrument: string;
  price: number;
}

const bond = (id: string, parentId: string | null, price = 100): Bond => ({
  id,
  parentId,
  instrument: id.toUpperCase(),
  price,
});

/** A group with `childCount` children beneath it. */
const group = (id: string, childCount: number): Bond[] => [
  bond(id, null),
  ...Array.from({ length: childCount }, (_, i) => bond(`${id}-c${i}`, id)),
];

let pipeline: GridPipeline<Bond>;
let registry: ModuleRegistry<Bond>;
let tree: TreeModule<Bond>;

const setup = (data: Bond[], options: Partial<TreeModuleOptions<Bond>> = {}) => {
  pipeline = new GridPipeline<Bond>({ getRowId: (d) => d.id });
  pipeline.store.setRowData(data);
  tree = new TreeModule<Bond>({ getParentId: (d) => d.parentId, ...options });
  registry = new ModuleRegistry<Bond>({
    pipeline,
    getColumns: () => [{ colId: 'instrument', headerName: 'Instrument', width: 100, index: 0 }],
    dispatch: () => {},
  });
  registry.register(tree);
  registry.start();
  return { pipeline, tree };
};

const visible = (): readonly DisplayRow[] => pipeline.projector.rows.get();
const ids = () => visible().map((r) => r.rowId);
const depths = () => visible().map((r) => r.meta?.['depth']);

beforeEach(() => {
  // Each test builds its own; this just guards against leakage.
  registry?.destroy();
});

describe('TreeModule', () => {
  describe('flattening', () => {
    it('shows only roots while everything is collapsed', () => {
      setup([...group('g1', 3), ...group('g2', 2)]);

      expect(ids()).toEqual(['g1', 'g2']);
    });

    it('shows children of an expanded row', () => {
      setup([...group('g1', 2), ...group('g2', 1)]);

      tree.setExpanded('g1', true);

      expect(ids()).toEqual(['g1', 'g1-c0', 'g1-c1', 'g2']);
    });

    it('annotates depth', () => {
      setup([bond('a', null), bond('b', 'a'), bond('c', 'b')]);
      tree.expandAll();

      expect(depths()).toEqual([0, 1, 2]);
    });

    it('marks whether a row has children, so the expander only appears where it should', () => {
      setup([...group('g1', 1)]);
      tree.expandAll();

      expect(visible().map((r) => r.meta?.['hasChildren'])).toEqual([true, false]);
    });

    it('treats a row whose parent is absent from the store as a root', () => {
      setup([bond('orphan', 'missing-parent')]);

      expect(ids()).toEqual(['orphan']);
    });

    it('does not loop on a parent cycle', () => {
      const a = { ...bond('a', 'b') };
      const b = { ...bond('b', 'a') };

      expect(() => setup([a, b])).not.toThrow();
      expect(ids().length).toBeGreaterThan(0);
    });

    it('preserves the incoming sibling order, which is how sort stays hierarchy-blind', () => {
      setup([...group('g1', 3)]);
      tree.expandAll();

      // A sort stage runs before the tree stage and reverses the flat list.
      pipeline.addStage({ id: 'reverse', phase: 'sort', run: (rows) => [...rows].reverse() });

      expect(ids()).toEqual(['g1', 'g1-c2', 'g1-c1', 'g1-c0']);
    });
  });

  describe('repeatOnBreak', () => {
    it('hangs the ancestor chain off every non-root row', () => {
      setup([...group('g1', 2)]);
      tree.expandAll();

      const child = visible().find((r) => r.rowId === 'g1-c0');
      expect(child?.repeatOnBreak?.map((r) => r.rowId)).toEqual(['g1']);
    });

    it('gives no chain to a root row', () => {
      setup([...group('g1', 1)]);

      expect(visible()[0]!.repeatOnBreak).toBeUndefined();
    });

    it('builds a multi-level chain root-first', () => {
      setup([bond('a', null), bond('b', 'a'), bond('c', 'b')]);
      tree.expandAll();

      const deepest = visible().find((r) => r.rowId === 'c');
      expect(deepest?.repeatOnBreak?.map((r) => r.rowId)).toEqual(['a', 'b']);
    });

    it('makes the layout repeat a group heading across an instance break', () => {
      // The end-to-end behaviour layouts.md describes: a group with more children
      // than fit must reappear atop the continuation.
      setup([...group('g1', 14)]);
      tree.expandAll();

      const viewport: ViewportMetrics = {
        width: 500,
        height: 360,
        rowHeight: 32,
        headerHeight: 40,
        instanceWidth: 200,
        instanceGap: 0,
      };
      const result = new FlowLayoutEngine().layout(visible(), viewport);

      expect(result.instances).toHaveLength(2);
      expect(result.instances[0]!.rows[0]!.rowId).toBe('g1');
      expect(result.instances[1]!.rows[0]!.rowId).toBe('g1');
      expect(result.instances[1]!.rows[0]!.meta?.['isRepeat']).toBe(true);
    });
  });

  describe('expansion', () => {
    it('toggles', () => {
      setup([...group('g1', 1)]);

      tree.toggleExpanded('g1');
      expect(ids()).toHaveLength(2);

      tree.toggleExpanded('g1');
      expect(ids()).toHaveLength(1);
    });

    it('expandAll expands only rows that have children', () => {
      setup([...group('g1', 2)]);

      tree.expandAll();

      expect(tree.isExpanded('g1')).toBe(true);
      expect(tree.isExpanded('g1-c0')).toBe(false);
    });

    it('collapseAll hides every child', () => {
      setup([...group('g1', 2), ...group('g2', 2)]);
      tree.expandAll();

      tree.collapseAll();

      expect(ids()).toEqual(['g1', 'g2']);
    });

    it('hides grandchildren when an intermediate row is collapsed', () => {
      setup([bond('a', null), bond('b', 'a'), bond('c', 'b')]);
      tree.expandAll();

      tree.setExpanded('b', false);

      expect(ids()).toEqual(['a', 'b']);
    });

    it('seeds expansion from defaultExpanded', () => {
      setup([...group('g1', 2)], { defaultExpanded: (d) => d.parentId === null });

      expect(ids()).toEqual(['g1', 'g1-c0', 'g1-c1']);
    });

    it('does not re-expand a row the user collapsed when new rows arrive', () => {
      setup([...group('g1', 2)], { defaultExpanded: true });
      tree.setExpanded('g1', false);

      pipeline.store.applyTransaction({ add: [bond('g2', null)] });
      pipeline.store.flushSync();

      expect(tree.isExpanded('g1')).toBe(false);
    });
  });

  describe('reacting to data', () => {
    it('picks up a child added under an expanded parent', () => {
      setup([...group('g1', 1)]);
      tree.expandAll();

      pipeline.store.applyTransaction({ add: [bond('g1-c9', 'g1')] });
      pipeline.store.flushSync();

      expect(ids()).toContain('g1-c9');
    });

    it('drops descendants of a removed parent', () => {
      setup([...group('g1', 2)]);
      tree.expandAll();

      pipeline.store.applyTransaction({ remove: ['g1'] });
      pipeline.store.flushSync();

      // The children survive as roots rather than vanishing from the grid.
      expect(ids()).toEqual(['g1-c0', 'g1-c1']);
    });
  });

  describe('cooperation with filtering', () => {
    it('restores an ancestor a filter removed, so a deep match stays reachable', () => {
      setup([...group('g1', 3)]);
      tree.expandAll();
      pipeline.addStage({
        id: 'filter',
        phase: 'filter',
        run: (rows) => rows.filter((r) => r.rowId === 'g1-c1'),
      });

      expect(ids()).toEqual(['g1', 'g1-c1']);
    });

    it('marks a restored ancestor so a renderer can style it as context only', () => {
      setup([...group('g1', 3)]);
      tree.expandAll();
      pipeline.addStage({
        id: 'filter',
        phase: 'filter',
        run: (rows) => rows.filter((r) => r.rowId === 'g1-c1'),
      });

      expect(visible()[0]!.meta?.['isAncestorOnly']).toBe(true);
    });

    it('drops the ancestor when retainAncestors is off', () => {
      setup([...group('g1', 3)], { retainAncestors: false });
      tree.expandAll();
      pipeline.addStage({
        id: 'filter',
        phase: 'filter',
        run: (rows) => rows.filter((r) => r.rowId === 'g1-c1'),
      });

      expect(ids()).toEqual(['g1-c1']);
    });
  });

  describe('state', () => {
    it('round-trips expansion', () => {
      setup([...group('g1', 1), ...group('g2', 1)]);
      tree.setExpanded('g1', true);
      const saved = tree.getState();

      tree.collapseAll();
      tree.setState(saved);

      expect(tree.isExpanded('g1')).toBe(true);
      expect(tree.isExpanded('g2')).toBe(false);
    });
  });

  describe('hierarchy option', () => {
    it('accepts an ancestor path instead of a parent id', () => {
      interface Pathed {
        id: string;
        hierarchy: string[];
      }
      const p = new GridPipeline<Pathed>({ getRowId: (d) => d.id });
      p.store.setRowData([
        { id: 'g', hierarchy: [] },
        { id: 'i', hierarchy: ['g'] },
        { id: 'o', hierarchy: ['g', 'i'] },
      ]);
      const module = new TreeModule<Pathed>({ getHierarchy: (d) => d.hierarchy });
      const reg = new ModuleRegistry<Pathed>({
        pipeline: p,
        getColumns: () => [],
        dispatch: () => {},
      });
      reg.register(module);
      reg.start();
      module.expandAll();

      expect(p.projector.rows.get().map((r) => r.rowId)).toEqual(['g', 'i', 'o']);
    });
  });
});
