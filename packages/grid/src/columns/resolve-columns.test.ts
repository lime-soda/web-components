import { describe, expect, it } from 'vite-plus/test';
import type { RowNode } from '../store/types.js';
import { formatCellValue, getCellValue, resolveColumns } from './resolve-columns.js';
import type { ColumnDef } from './types.js';

interface Quote {
  id: string;
  instrument: string;
  price: number;
  quote?: { bid?: { price?: number } };
}

const node = (data: Partial<Quote> = {}): RowNode<Quote> => ({
  id: data.id ?? 'a',
  data: { id: 'a', instrument: 'UKT 4% 2030', price: 101.25, ...data } as Quote,
});

const resolve = (defs: ColumnDef<Quote>[], options = {}) => resolveColumns<Quote>(defs, options);

describe('resolveColumns', () => {
  describe('identity', () => {
    it('derives colId from field when not given', () => {
      expect(resolve([{ field: 'price' }])[0]!.colId).toBe('price');
    });

    it('prefers an explicit colId', () => {
      expect(resolve([{ colId: 'px', field: 'price' }])[0]!.colId).toBe('px');
    });

    it('falls back to a positional id for a column with neither', () => {
      expect(resolve([{ headerName: 'Actions' }])[0]!.colId).toBe('col-0');
    });

    it('disambiguates duplicate ids so keyed rendering stays correct', () => {
      const columns = resolve([{ field: 'price' }, { field: 'price' }]);

      expect(columns.map((c) => c.colId)).toEqual(['price', 'price-1']);
    });

    it('records the column index', () => {
      expect(resolve([{ field: 'a' }, { field: 'b' }]).map((c) => c.index)).toEqual([0, 1]);
    });
  });

  describe('header and width defaults', () => {
    it('humanises the field into a header name when none is given', () => {
      expect(resolve([{ field: 'bidPrice' }])[0]!.headerName).toBe('Bid Price');
    });

    it('humanises only the last segment of a dot path', () => {
      expect(resolve([{ field: 'quote.bid.price' }])[0]!.headerName).toBe('Price');
    });

    it('keeps an explicit header name verbatim', () => {
      expect(resolve([{ field: 'price', headerName: 'PX' }])[0]!.headerName).toBe('PX');
    });

    it('applies a default width', () => {
      expect(resolve([{ field: 'price' }])[0]!.width).toBe(100);
    });

    it('raises width to minWidth when width is below it', () => {
      expect(resolve([{ field: 'price', width: 40, minWidth: 80 }])[0]!.width).toBe(80);
    });
  });

  describe('defaultColDef and columnTypes', () => {
    it('applies defaultColDef beneath the column definition', () => {
      const columns = resolve([{ field: 'price' }], { defaultColDef: { width: 150 } });

      expect(columns[0]!.width).toBe(150);
    });

    it('lets the column definition win over defaultColDef', () => {
      const columns = resolve([{ field: 'price', width: 60 }], { defaultColDef: { width: 150 } });

      expect(columns[0]!.width).toBe(60);
    });

    it('applies a named column type between defaults and the definition', () => {
      const columns = resolve([{ field: 'price', type: 'numeric' }], {
        defaultColDef: { width: 100 },
        columnTypes: { numeric: { width: 80, cellClass: 'align-right' } },
      });

      expect(columns[0]).toMatchObject({ width: 80, cellClass: 'align-right' });
    });

    it('applies several column types left to right', () => {
      const columns = resolve([{ field: 'price', type: ['numeric', 'money'] }], {
        columnTypes: { numeric: { width: 80 }, money: { width: 120 } },
      });

      expect(columns[0]!.width).toBe(120);
    });

    it('ignores an unknown column type rather than throwing', () => {
      expect(() => resolve([{ field: 'price', type: 'nope' }])).not.toThrow();
    });
  });
});

describe('getCellValue', () => {
  it('reads a plain field', () => {
    const column = resolve([{ field: 'price' }])[0]!;

    expect(getCellValue(column, node())).toBe(101.25);
  });

  it('reads a dot path', () => {
    const column = resolve([{ field: 'quote.bid.price' }])[0]!;

    expect(getCellValue(column, node({ quote: { bid: { price: 99.5 } } }))).toBe(99.5);
  });

  it('returns undefined for a broken dot path instead of throwing', () => {
    const column = resolve([{ field: 'quote.bid.price' }])[0]!;

    expect(getCellValue(column, node())).toBeUndefined();
  });

  it('returns undefined for a column with no field and no getter', () => {
    const column = resolve([{ headerName: 'Actions' }])[0]!;

    expect(getCellValue(column, node())).toBeUndefined();
  });

  it('prefers valueGetter over field', () => {
    const column = resolve([{ field: 'price', valueGetter: ({ data }) => data.price * 2 }])[0]!;

    expect(getCellValue(column, node())).toBe(202.5);
  });

  it('gives valueGetter the data, node and column', () => {
    let seen: Record<string, unknown> = {};
    const column = resolve([
      {
        colId: 'derived',
        valueGetter: (params) => {
          seen = { ...params };
          return 1;
        },
      },
    ])[0]!;

    getCellValue(column, node());

    expect(seen['data']).toMatchObject({ id: 'a' });
    expect(seen['node']).toMatchObject({ id: 'a' });
    expect(seen['column']).toMatchObject({ colId: 'derived' });
  });
});

describe('formatCellValue', () => {
  it('stringifies a value when no formatter is given', () => {
    const column = resolve([{ field: 'price' }])[0]!;

    expect(formatCellValue(column, node())).toBe('101.25');
  });

  it('renders null and undefined as an empty string, not "null"', () => {
    const column = resolve([{ field: 'missing' }])[0]!;

    expect(formatCellValue(column, node())).toBe('');
  });

  it('applies valueFormatter to the value from valueGetter', () => {
    const column = resolve([
      {
        field: 'price',
        valueGetter: ({ data }) => data.price,
        valueFormatter: ({ value }) => (value as number).toFixed(3),
      },
    ])[0]!;

    expect(formatCellValue(column, node())).toBe('101.250');
  });

  it('gives valueFormatter the resolved value alongside the row', () => {
    const column = resolve([
      {
        field: 'price',
        valueFormatter: ({ value, data }) => `${data.instrument}: ${String(value)}`,
      },
    ])[0]!;

    expect(formatCellValue(column, node())).toBe('UKT 4% 2030: 101.25');
  });
});
