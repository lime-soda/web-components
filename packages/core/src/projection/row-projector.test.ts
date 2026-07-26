import { describe, expect, it, vi } from 'vitest';
import { RowStore } from '../store/row-store.js';
import { RowProjector } from './row-projector.js';
import type { ProjectionStage } from './types.js';

interface Quote {
  id: string;
  price: number;
  group?: string;
}

const setup = (data: Quote[]) => {
  const store = new RowStore<Quote>({ getRowId: (d) => d.id });
  store.setRowData(data);
  return { store, projector: new RowProjector(store) };
};

const quote = (id: string, price = 100): Quote => ({ id, price });

const ids = (rows: readonly { rowId: string }[]) => rows.map((r) => r.rowId);

/** Records how often it ran, so memoisation can be asserted directly. */
const countingStage = (
  overrides: Partial<ProjectionStage<Quote>> = {},
): ProjectionStage<Quote> & { runs: number } => {
  const stage = {
    id: 'counting',
    phase: 'sort' as const,
    runs: 0,
    run(rows: readonly { rowId: string }[]) {
      stage.runs += 1;
      return rows;
    },
  };
  // defineProperties rather than spread: spreading would evaluate a `dependsOn`
  // getter once and freeze its value, defeating the "consulted freshly" test.
  Object.defineProperties(stage, Object.getOwnPropertyDescriptors(overrides));
  return stage as unknown as ProjectionStage<Quote> & { runs: number };
};

describe('RowProjector', () => {
  describe('with no stages', () => {
    it('is the identity projection', () => {
      const { projector } = setup([quote('a'), quote('b')]);

      expect(ids(projector.rows.get())).toEqual(['a', 'b']);
    });

    it('gives each display row an id and a rowId', () => {
      const { projector } = setup([quote('a')]);

      expect(projector.rows.get()[0]).toMatchObject({ id: 'a', rowId: 'a' });
    });
  });

  describe('phase ordering', () => {
    it('runs phases in filter → sort → expand → decorate order regardless of registration order', () => {
      const { projector } = setup([quote('a')]);
      const order: string[] = [];
      const record = (
        id: string,
        phase: ProjectionStage<Quote>['phase'],
      ): ProjectionStage<Quote> => ({
        id,
        phase,
        run: (rows) => {
          order.push(id);
          return rows;
        },
      });

      projector.addStage(record('decorate', 'decorate'));
      projector.addStage(record('expand', 'expand'));
      projector.addStage(record('sort', 'sort'));
      projector.addStage(record('filter', 'filter'));
      projector.rows.get();

      expect(order).toEqual(['filter', 'sort', 'expand', 'decorate']);
    });

    it('preserves registration order within a phase', () => {
      const { projector } = setup([quote('a')]);
      const order: string[] = [];
      const record = (id: string): ProjectionStage<Quote> => ({
        id,
        phase: 'decorate',
        run: (rows) => {
          order.push(id);
          return rows;
        },
      });

      projector.addStage(record('first'));
      projector.addStage(record('second'));
      projector.rows.get();

      expect(order).toEqual(['first', 'second']);
    });
  });

  describe('stage behaviour', () => {
    it('lets a stage drop rows', () => {
      const { projector, store } = setup([quote('a'), quote('b')]);
      projector.addStage({
        id: 'filter',
        phase: 'filter',
        run: (rows, ctx) => rows.filter((r) => ctx.store.getRow(r.rowId)!.id !== 'a'),
      });

      expect(ids(projector.rows.get())).toEqual(['b']);
      expect(store.size).toBe(2);
    });

    it('lets a stage reorder rows', () => {
      const { projector } = setup([quote('a', 2), quote('b', 1)]);
      projector.addStage({
        id: 'sort',
        phase: 'sort',
        run: (rows, ctx) =>
          [...rows].sort(
            (x, y) => ctx.store.getRow(x.rowId)!.price - ctx.store.getRow(y.rowId)!.price,
          ),
      });

      expect(ids(projector.rows.get())).toEqual(['b', 'a']);
    });

    it('lets a stage add rows and annotate them', () => {
      const { projector } = setup([quote('a')]);
      projector.addStage({
        id: 'expand',
        phase: 'expand',
        run: (rows) =>
          rows.flatMap((r) => [
            { ...r, meta: { depth: 0 } },
            { id: `${r.id}-child`, rowId: 'a' },
          ]),
      });

      const result = projector.rows.get();
      expect(result).toHaveLength(2);
      expect(result[0]!.meta).toEqual({ depth: 0 });
    });

    it('removes a stage when its disposer is called', () => {
      const { projector } = setup([quote('a'), quote('b')]);
      const dispose = projector.addStage({
        id: 'filter',
        phase: 'filter',
        run: (rows) => rows.slice(0, 1),
      });

      expect(projector.rows.get()).toHaveLength(1);

      dispose();

      expect(projector.rows.get()).toHaveLength(2);
    });
  });

  describe('memoisation', () => {
    it('does not re-run stages when nothing has changed', () => {
      const { projector } = setup([quote('a')]);
      const stage = countingStage();
      projector.addStage(stage);

      projector.rows.get();
      projector.rows.get();
      projector.rows.get();

      expect(stage.runs).toBe(1);
    });

    it('re-runs stages after a structural change', () => {
      const { projector, store } = setup([quote('a')]);
      const stage = countingStage();
      projector.addStage(stage);
      projector.rows.get();

      store.applyTransaction({ add: [quote('b')] });
      projector.rows.get();

      expect(stage.runs).toBe(2);
    });

    it('re-runs stages when invalidate() is called for a config change', () => {
      // How a module signals "my sort model changed" without touching row data.
      const { projector } = setup([quote('a')]);
      const stage = countingStage();
      projector.addStage(stage);
      projector.rows.get();

      projector.invalidate();
      projector.rows.get();

      expect(stage.runs).toBe(2);
    });
  });

  describe('dependsOn', () => {
    it('does NOT re-run a stage when an unrelated field ticks', () => {
      // The central performance guarantee: sorting by instrument means a price
      // tick must not re-run the sort, the projection, or the layout.
      const { projector, store } = setup([quote('a', 100)]);
      const stage = countingStage({ dependsOn: new Set(['group']) });
      projector.addStage(stage);
      projector.rows.get();

      store.applyTransaction({ update: [{ id: 'a', price: 101 }] });
      store.flushSync();
      projector.rows.get();

      expect(stage.runs).toBe(1);
    });

    it('re-runs a stage when a field it depends on ticks', () => {
      const { projector, store } = setup([quote('a', 100)]);
      const stage = countingStage({ dependsOn: new Set(['price']) });
      projector.addStage(stage);
      projector.rows.get();

      store.applyTransaction({ update: [{ id: 'a', price: 101 }] });
      store.flushSync();
      projector.rows.get();

      expect(stage.runs).toBe(2);
    });

    it("re-runs a stage declaring '*' on any value change", () => {
      const { projector, store } = setup([quote('a', 100)]);
      const stage = countingStage({ dependsOn: '*' });
      projector.addStage(stage);
      projector.rows.get();

      store.applyTransaction({ update: [{ id: 'a', price: 101 }] });
      store.flushSync();
      projector.rows.get();

      expect(stage.runs).toBe(2);
    });

    it('does not re-run a stage with no declared dependencies on a value change', () => {
      const { projector, store } = setup([quote('a', 100)]);
      const stage = countingStage();
      projector.addStage(stage);
      projector.rows.get();

      store.applyTransaction({ update: [{ id: 'a', price: 101 }] });
      store.flushSync();
      projector.rows.get();

      expect(stage.runs).toBe(1);
    });

    it('re-runs a stage when a structural change and a value change coalesce', () => {
      // Notifications are batched, so one delivery can report both. A live feed
      // does this constantly: a tick arriving in the same batch as an added row.
      // Handling only the structural half leaves a sort stale against data that
      // has already moved.
      const { projector, store } = setup([quote('a', 100)]);
      const stage = countingStage({ dependsOn: new Set(['price']) });
      projector.addStage(stage);
      projector.rows.get();

      store.applyTransaction({ add: [quote('b', 50)] });
      store.applyTransaction({ update: [{ id: 'a', price: 101 }] });
      store.flushSync();
      projector.rows.get();

      expect(stage.runs).toBe(2);
    });

    it('consults dependsOn freshly each time, so a changing sort model is respected', () => {
      // A module returns a live set: sort by price now, by group later.
      const { projector, store } = setup([quote('a', 100)]);
      let dependencies = new Set(['group']);
      const stage = countingStage({
        get dependsOn() {
          return dependencies;
        },
      });
      projector.addStage(stage);
      projector.rows.get();

      dependencies = new Set(['price']);
      store.applyTransaction({ update: [{ id: 'a', price: 101 }] });
      store.flushSync();
      projector.rows.get();

      expect(stage.runs).toBe(2);
    });
  });

  it('notifies subscribers when the projection changes', () => {
    const { projector, store } = setup([quote('a')]);
    const listener = vi.fn();
    projector.subscribe(listener);

    store.applyTransaction({ add: [quote('b')] });
    store.flushSync();

    expect(listener).toHaveBeenCalled();
  });

  it('does not notify subscribers for a value change no stage cares about', () => {
    const { projector, store } = setup([quote('a', 100)]);
    projector.addStage(countingStage({ dependsOn: new Set(['group']) }));
    const listener = vi.fn();
    projector.subscribe(listener);

    store.applyTransaction({ update: [{ id: 'a', price: 101 }] });
    store.flushSync();

    expect(listener).not.toHaveBeenCalled();
  });
});
