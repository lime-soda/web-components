import { describe, expect, it, vi } from 'vitest';
import { RowStore } from './row-store.js';

interface Quote {
  id: string;
  instrument: string;
  price: number;
  size?: number;
}

const store = (initial: Quote[] = []) => {
  const s = new RowStore<Quote>({ getRowId: (d) => d.id });
  if (initial.length > 0) s.setRowData(initial);
  return s;
};

const quote = (id: string, price = 100): Quote => ({ id, instrument: id.toUpperCase(), price });

describe('RowStore', () => {
  describe('reads', () => {
    it('preserves insertion order', () => {
      const s = store([quote('c'), quote('a'), quote('b')]);

      expect(s.rows.get().map((r) => r.id)).toEqual(['c', 'a', 'b']);
    });

    it('returns undefined for an unknown row', () => {
      expect(store().getRow('nope')).toBeUndefined();
    });

    it('exposes the consumer data object unchanged', () => {
      const data = quote('a');

      expect(store([data]).getRow('a')).toEqual(data);
    });
  });

  describe('applyTransaction', () => {
    it('adds rows and reports them as structural', () => {
      const s = store([quote('a')]);

      const result = s.applyTransaction({ add: [quote('b')] });

      expect(result.added).toEqual(['b']);
      expect(result.structural).toBe(true);
      expect(s.rows.get().map((r) => r.id)).toEqual(['a', 'b']);
    });

    it('removes rows and reports them as structural', () => {
      const s = store([quote('a'), quote('b')]);

      const result = s.applyTransaction({ remove: ['a'] });

      expect(result.removed).toEqual(['a']);
      expect(result.structural).toBe(true);
      expect(s.getRow('a')).toBeUndefined();
    });

    it('treats a value update as NON-structural', () => {
      // The single most important assertion in this file. A price tick must not
      // look like a change to the shape of the grid, or the projection and layout
      // rebuild on every tick — which is what made the prototype expensive.
      const s = store([quote('a', 100)]);

      const result = s.applyTransaction({ update: [quote('a', 101)] });

      expect(result.updated).toEqual(['a']);
      expect(result.structural).toBe(false);
    });

    it('reports which fields changed so stages can decide whether to re-run', () => {
      const s = store([{ id: 'a', instrument: 'A', price: 100, size: 5 }]);

      const result = s.applyTransaction({
        update: [{ id: 'a', instrument: 'A', price: 101, size: 5 }],
      });

      expect([...result.fieldsChanged]).toEqual(['price']);
    });

    it('reports added and removed fields, not just changed values', () => {
      const s = store([{ id: 'a', instrument: 'A', price: 100 }]);

      const result = s.applyTransaction({ update: [{ id: 'a', instrument: 'A', price: 100, size: 9 }] });

      expect([...result.fieldsChanged]).toEqual(['size']);
    });

    it('ignores updates for unknown rows rather than creating them', () => {
      const s = store([quote('a')]);

      const result = s.applyTransaction({ update: [quote('ghost')] });

      expect(result.updated).toEqual([]);
      expect(s.getRow('ghost')).toBeUndefined();
    });

    it('ignores removals of unknown rows', () => {
      expect(store([quote('a')]).applyTransaction({ remove: ['ghost'] }).removed).toEqual([]);
    });

    it('replaces an existing row when adding a duplicate id', () => {
      const s = store([quote('a', 100)]);

      s.applyTransaction({ add: [quote('a', 200)] });

      expect(s.getRow('a')?.price).toBe(200);
      expect(s.rows.get()).toHaveLength(1);
    });

    it('applies add, update and remove in one pass', () => {
      const s = store([quote('a'), quote('b')]);

      const result = s.applyTransaction({
        add: [quote('c')],
        update: [quote('b', 55)],
        remove: ['a'],
      });

      expect(result).toMatchObject({ added: ['c'], updated: ['b'], removed: ['a'], structural: true });
      expect(s.rows.get().map((r) => r.id)).toEqual(['b', 'c']);
      expect(s.getRow('b')?.price).toBe(55);
    });
  });

  describe('invalidation', () => {
    it('bumps the structural version on add and remove', () => {
      const s = store([quote('a')]);
      const before = s.structuralVersion.get();

      s.applyTransaction({ add: [quote('b')] });

      expect(s.structuralVersion.get()).toBeGreaterThan(before);
    });

    it('does NOT bump the structural version on a value update', () => {
      // Guards the claim that ticks bypass projection and layout entirely.
      const s = store([quote('a', 100)]);
      const before = s.structuralVersion.get();

      s.applyTransaction({ update: [quote('a', 101)] });

      expect(s.structuralVersion.get()).toBe(before);
    });

    it('keeps the rows array identity stable across a value update', () => {
      const s = store([quote('a', 100)]);
      const before = s.rows.get();

      s.applyTransaction({ update: [quote('a', 101)] });

      expect(s.rows.get()).toBe(before);
    });
  });

  describe('row signals', () => {
    it('exposes the current node and updates it in place', () => {
      const s = store([quote('a', 100)]);
      const sig = s.rowSignal('a');

      expect(sig.get()?.data.price).toBe(100);

      s.applyTransaction({ update: [quote('a', 101)] });

      expect(sig.get()?.data.price).toBe(101);
    });

    it('returns the same signal instance for repeated lookups', () => {
      // Repeated ancestor rows resolve the same signal, which is how one update
      // repaints a parent in every instance that shows it.
      const s = store([quote('a')]);

      expect(s.rowSignal('a')).toBe(s.rowSignal('a'));
    });

    it('gives a signal for a row that does not exist yet, and fills it on add', () => {
      const s = store();
      const sig = s.rowSignal('late');

      expect(sig.get()).toBeUndefined();

      s.applyTransaction({ add: [quote('late')] });

      expect(sig.get()?.id).toBe('late');
    });

    it('clears the signal when the row is removed', () => {
      const s = store([quote('a')]);
      const sig = s.rowSignal('a');

      s.applyTransaction({ remove: ['a'] });

      expect(sig.get()).toBeUndefined();
    });

    it('gives each updated row a fresh data identity for change detection', () => {
      const s = store([quote('a', 100)]);
      const before = s.rowSignal('a').get();

      s.applyTransaction({ update: [quote('a', 101)] });

      expect(s.rowSignal('a').get()).not.toBe(before);
    });
  });

  describe('subscribers', () => {
    it('coalesces transactions applied in the same microtask into one notification', async () => {
      const s = store([quote('a'), quote('b')]);
      const listener = vi.fn();
      s.subscribe(listener);

      s.applyTransaction({ update: [quote('a', 1)] });
      s.applyTransaction({ update: [quote('b', 2)] });
      await Promise.resolve();

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0]![0].updated).toEqual(['a', 'b']);
    });

    it('applies data synchronously even though notification is deferred', () => {
      const s = store([quote('a', 100)]);
      s.subscribe(vi.fn());

      s.applyTransaction({ update: [quote('a', 101)] });

      expect(s.getRow('a')?.price).toBe(101);
    });

    it('flushSync delivers pending notifications immediately', () => {
      const s = store([quote('a')]);
      const listener = vi.fn();
      s.subscribe(listener);

      s.applyTransaction({ update: [quote('a', 1)] });
      s.flushSync();

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('stops notifying after unsubscribe', () => {
      const s = store([quote('a')]);
      const listener = vi.fn();
      const unsubscribe = s.subscribe(listener);

      unsubscribe();
      s.applyTransaction({ update: [quote('a', 1)] });
      s.flushSync();

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('setRowData', () => {
    it('replaces the whole set and reports the difference', () => {
      const s = store([quote('a'), quote('b')]);

      const result = s.setRowData([quote('b'), quote('c')]);

      expect(result).toMatchObject({ added: ['c'], removed: ['a'], structural: true });
      expect(s.rows.get().map((r) => r.id)).toEqual(['b', 'c']);
    });
  });
});
