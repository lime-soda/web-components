import { describe, expect, it } from 'vite-plus/test';
import { spannedColumns } from './col-span.js';
import { resolveColumns } from './resolve-columns.js';
import type { DisplayRow } from '../layout/types.js';
import type { RowNode } from '../store/types.js';

interface Row {
  id: string;
  name: string;
  bid: number;
  ask: number;
  isGroup: boolean;
}

const columns = (colSpan?: unknown) =>
  resolveColumns<Row>([{ field: 'name', colSpan } as never, { field: 'bid' }, { field: 'ask' }]);

const node = (over: Partial<Row> = {}): RowNode<Row> => ({
  id: 'r',
  data: { id: 'r', name: 'A', bid: 1, ask: 2, isGroup: false, ...over },
});

const row: DisplayRow = { id: 'r', rowId: 'r', meta: {} };

describe('spannedColumns', () => {
  it('gives every column its own cell by default', () => {
    const laidOut = spannedColumns(columns(), row, node());

    expect(laidOut.map((entry) => entry.column.colId)).toEqual(['name', 'bid', 'ask']);
    expect(laidOut.every((entry) => entry.span === 1)).toBe(true);
  });

  it('drops the columns a span covers', () => {
    const laidOut = spannedColumns(columns(3), row, node());

    expect(laidOut).toHaveLength(1);
    expect(laidOut[0]).toMatchObject({ span: 3 });
  });

  it('resolves the span per row, which is the whole point', () => {
    // The group heading covers the grid; the instrument under it does not.
    const cols = columns(({ data }: { data: Row }) => (data.isGroup ? 3 : 1));

    expect(spannedColumns(cols, row, node({ isGroup: true }))).toHaveLength(1);
    expect(spannedColumns(cols, row, node({ isGroup: false }))).toHaveLength(3);
  });

  it('never runs past the last column', () => {
    // Otherwise the row asks the grid for tracks that do not exist.
    const laidOut = spannedColumns(columns(99), row, node());

    expect(laidOut).toHaveLength(1);
    expect(laidOut[0]!.span).toBe(3);
  });

  it('treats a nonsense span as a single column rather than looping', () => {
    for (const span of [0, -2, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const laidOut = spannedColumns(columns(span), row, node());
      expect(laidOut.length, `span ${span}`).toBeGreaterThan(0);
      expect(laidOut[0]!.span, `span ${span}`).toBeGreaterThanOrEqual(1);
    }
  });

  it('falls back to one column when there is no node to ask', () => {
    const cols = columns(() => 3);

    expect(spannedColumns(cols, row, undefined)).toHaveLength(3);
  });
});
