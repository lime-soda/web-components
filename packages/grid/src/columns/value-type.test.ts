import { describe, expect, it } from 'vite-plus/test';
import { formatCellValue, resolveColumns } from './resolve-columns.js';
import type { RowNode } from '../store/types.js';

/**
 * What a column's value type decides.
 *
 * Two things, and both were being done by hand per column before: which edge
 * the value sits against, and how it reads when nothing formats it. A column of
 * prices aligned left cannot be read down — the digits that matter stop lining
 * up — and the styling for the right edge existed here for months with nothing
 * able to reach it.
 */

interface Row {
  price: number;
  name: string;
  traded: Date;
  settled: boolean;
}

const node = (data: Partial<Row>): RowNode<Row> => ({ id: 'r', data: data as Row });

const resolve = (definition: Parameters<typeof resolveColumns<Row>>[0][number]) =>
  resolveColumns<Row>([definition])[0]!;

describe('a column with no value type', () => {
  it('is text, and changes nothing', () => {
    const column = resolve({ field: 'name' });

    expect(column.valueType).toBe('text');
    expect(column.align).toBe('start');
    expect(formatCellValue(column, node({ name: 'UKT 4% 2030' }))).toBe('UKT 4% 2030');
  });
});

describe('alignment follows the value type', () => {
  it('puts numbers against the right edge', () => {
    // So a column of them reads down rather than across.
    expect(resolve({ field: 'price', valueType: 'number' }).align).toBe('end');
  });

  it('leaves text and dates where the eye starts', () => {
    expect(resolve({ field: 'name', valueType: 'text' }).align).toBe('start');
    expect(resolve({ field: 'traded', valueType: 'date' }).align).toBe('start');
  });

  it('centres a boolean, which belongs to neither edge', () => {
    expect(resolve({ field: 'settled', valueType: 'boolean' }).align).toBe('center');
  });

  it('lets a column say otherwise', () => {
    // An identifier held as a number reads as a label, not a quantity.
    expect(resolve({ field: 'price', valueType: 'number', align: 'start' }).align).toBe('start');
  });
});

describe('formatting follows the value type', () => {
  it('gives a number its separators', () => {
    const column = resolve({ field: 'price', valueType: 'number' });

    expect(formatCellValue(column, node({ price: 1_500_000 }))).toBe((1_500_000).toLocaleString());
  });

  it('writes a date the way the reader does', () => {
    const traded = new Date('2026-03-04T00:00:00Z');
    const column = resolve({ field: 'traded', valueType: 'date' });

    expect(formatCellValue(column, node({ traded }))).toBe(traded.toLocaleDateString());
  });

  it('reads a date held as a string or an epoch', () => {
    // JSON has no date, so one arrives as whichever the server chose.
    const column = resolve({ field: 'traded', valueType: 'date' });
    const expected = new Date('2026-03-04T00:00:00Z').toLocaleDateString();

    expect(formatCellValue(column, node({ traded: '2026-03-04T00:00:00Z' as never }))).toBe(
      expected,
    );
    expect(formatCellValue(column, node({ traded: Date.parse('2026-03-04') as never }))).toBe(
      expected,
    );
  });

  it('says a boolean in words', () => {
    // A tick that means "false" by being absent leaves a screen reader with
    // nothing to read at all.
    const column = resolve({ field: 'settled', valueType: 'boolean' });

    expect(formatCellValue(column, node({ settled: true }))).toBe('Yes');
    expect(formatCellValue(column, node({ settled: false }))).toBe('No');
  });

  it('leaves a value alone when it is not what the type expected', () => {
    // Better a wrong-looking value than a thrown error or an empty cell: the
    // data is what it is, and the reader can see that it is not a date.
    const column = resolve({ field: 'traded', valueType: 'date' });

    expect(formatCellValue(column, node({ traded: 'not a date' as never }))).toBe('not a date');
  });

  it('still defers to a formatter', () => {
    // The type says what to do when nobody said. Somebody said.
    const column = resolve({
      field: 'price',
      valueType: 'number',
      valueFormatter: ({ value }) => `${(value as number).toFixed(3)}`,
    });

    expect(formatCellValue(column, node({ price: 100.5 }))).toBe('100.500');
  });

  it('shows nothing for a missing value, whatever the type', () => {
    for (const valueType of ['text', 'number', 'date', 'boolean'] as const) {
      const column = resolve({ field: 'price', valueType });
      expect(formatCellValue(column, node({}))).toBe('');
    }
  });
});
