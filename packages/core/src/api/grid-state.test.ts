import { describe, expect, expectTypeOf, it } from 'vite-plus/test';
import type { GridState } from './types.js';
import '../modules/sort/index.js';
import '../modules/filter/index.js';
import '../modules/selection/index.js';
import '../modules/tree/index.js';

/**
 * State is contributed the way API methods are: a module augments `GridState`
 * with the slice it owns, so importing the module is what makes the slice
 * exist — in the types as well as at runtime.
 */

describe('GridState', () => {
  it('is typed per module, so a slice is not an unknown blob', () => {
    const state: GridState = {
      sort: [{ colId: 'price', direction: 'asc' }],
      selection: ['r1'],
      tree: ['g0'],
      filter: { model: {}, quickFilter: 'gilt' },
    };

    expectTypeOf(state.selection).toEqualTypeOf<string[] | undefined>();
    expect(state.sort?.[0]?.colId).toBe('price');
    expect(state.filter?.quickFilter).toBe('gilt');
  });

  it('has every slice optional, so a partial profile still restores', () => {
    // Saved by a grid with more modules than the one reading it back.
    const partial: GridState = { selection: ['r1'] };

    expect(partial.sort).toBeUndefined();
    expectTypeOf<GridState['sort']>().toBeNullable();
  });

  it('survives a JSON round trip, which is the point of persisting it', () => {
    const state: GridState = { sort: [{ colId: 'price', direction: 'desc' }], tree: ['g0'] };

    const restored = JSON.parse(JSON.stringify(state)) as GridState;

    expect(restored).toEqual(state);
  });
});
