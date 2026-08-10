import { describe, expect, it } from 'vite-plus/test';
import { resolveColumns } from '../../columns/resolve-columns.js';
import { GridPipeline } from '../../pipeline/grid-pipeline.js';
import { ModuleRegistry } from '../module-registry.js';
import { SelectionModule } from '../selection/selection-module.js';
import { SortModule } from '../sort/sort-module.js';
import { FilterModule } from '../filter/filter-module.js';
import { ClipboardModule } from './clipboard-module.js';
import type { GridModule } from '../types.js';

/**
 * Getting data out, as text.
 *
 * The module is read-only, so what is worth testing is what it decides: which
 * rows, which columns, in what order, and how a field that would break the
 * format is escaped — which for financial data is not a corner case, since a
 * formatted number carries thousands separators.
 */

interface Bond {
  id: string;
  instrument: string;
  size: number;
  price: number;
}

const data: Bond[] = [
  { id: 'a', instrument: 'UKT 4% 2030', size: 1_500_000, price: 101.25 },
  { id: 'b', instrument: 'UKT 1% 2041', size: 250_000, price: 98.5 },
  { id: 'c', instrument: 'DBR 2% 2032', size: 3_000_000, price: 100.125 },
];

const setup = (modules: GridModule<Bond>[] = []) => {
  const pipeline = new GridPipeline<Bond>({ getRowId: (d) => d.id });
  pipeline.store.setRowData(data);

  const clipboard = new ClipboardModule<Bond>();
  const registry = new ModuleRegistry<Bond>({
    pipeline,
    getColumns: () =>
      resolveColumns<Bond>([
        { field: 'instrument', headerName: 'Instrument' },
        {
          field: 'size',
          headerName: 'Size',
          valueFormatter: ({ value }) => value!.toLocaleString('en-GB'),
        },
        { field: 'price', headerName: 'Price', valueFormatter: ({ value }) => value!.toFixed(3) },
      ]),
    dispatch: () => {},
  });
  for (const module of modules) registry.register(module);
  registry.register(clipboard);
  registry.start();
  pipeline.projector.rows.get();

  return { clipboard, registry, pipeline };
};

const lines = (text: string) => text.split('\n');

describe('ClipboardModule', () => {
  it('copies every projected row with its headings', () => {
    const { clipboard } = setup();

    const rows = lines(clipboard.toDelimitedText());

    expect(rows[0]).toBe('Instrument,Size,Price');
    expect(rows).toHaveLength(4);
  });

  it('formats each cell the way the screen does', () => {
    // Not the raw value: a price shown to three decimals copies that way, and a
    // size copies with its separators, so a paste matches what was read.
    const { clipboard } = setup();

    expect(clipboard.toDelimitedText({ includeHeaders: false })).toContain('101.250');
  });

  it('quotes a field the delimiter would otherwise split', () => {
    // 1,500,000 through a comma-separated export is three columns unless quoted,
    // which would silently shift every column after it.
    const { clipboard } = setup();

    const row = lines(clipboard.toDelimitedText({ includeHeaders: false }))[0]!;

    expect(row).toContain('"1,500,000"');
    expect(row.split(',')).toHaveLength(5); // the quoted field still contains commas
  });

  it('leaves fields alone when a tab separates them', () => {
    // The clipboard format has no such collision, so quoting would be noise in
    // the spreadsheet cell.
    const { clipboard } = setup();

    const row = lines(clipboard.toDelimitedText({ delimiter: '\t', includeHeaders: false }))[0]!;

    expect(row).toContain('1,500,000');
    expect(row).not.toContain('"');
  });

  it('doubles a quote already in the value', () => {
    const { clipboard, pipeline } = setup();
    pipeline.store.applyTransaction({
      update: [{ id: 'a', instrument: 'UKT 4% "on the run"', size: 1, price: 1 }],
    });
    pipeline.projector.rows.get();

    expect(clipboard.toDelimitedText()).toContain('"UKT 4% ""on the run"""');
  });

  it('follows the projection, so a filter and a sort come through', () => {
    const sort = new SortModule<Bond>();
    const filter = new FilterModule<Bond>();
    const { clipboard } = setup([sort, filter]);

    filter.setQuickFilter('UKT');
    sort.setSortModel([{ colId: 'price', direction: 'asc' }]);

    const rows = lines(clipboard.toDelimitedText({ includeHeaders: false }));

    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain('UKT 1% 2041'); // 98.5 sorts first
  });

  it('copies the selection when there is one, and everything when there is not', () => {
    const selection = new SelectionModule<Bond>();
    const { clipboard } = setup([selection]);

    expect(lines(clipboard.toDelimitedText({ includeHeaders: false }))).toHaveLength(3);

    selection.setRowSelected('c', true);

    expect(lines(clipboard.toDelimitedText({ includeHeaders: false }))).toHaveLength(1);
  });

  it('copies selected rows in the order they appear, not the order they were picked', () => {
    const selection = new SelectionModule<Bond>();
    const { clipboard } = setup([selection]);

    selection.setRowSelected('c', true);
    selection.setRowSelected('a', true);

    const rows = lines(clipboard.toDelimitedText({ includeHeaders: false }));

    expect(rows[0]).toContain('UKT 4% 2030'); // 'a' is first in the projection
  });

  it('works with no selection module at all', () => {
    // The point of it being standalone: nothing here declares a selection, and
    // asking for one falls back to the projection rather than throwing.
    const { clipboard } = setup();

    expect(lines(clipboard.toDelimitedText({ rows: 'selected' }))).toHaveLength(1); // headers only
    expect(lines(clipboard.toDelimitedText({ rows: 'all', includeHeaders: false }))).toHaveLength(
      3,
    );
  });

  it('leaves the selection checkbox column out', () => {
    // It is a control, not data, and would paste as a column of blanks.
    const selection = new SelectionModule<Bond>();
    const { clipboard } = setup([selection]);

    expect(clipboard.toDelimitedText().split('\n')[0]).toBe('Instrument,Size,Price');
  });

  it('takes an explicit column order, and ignores ids that have gone', () => {
    const { clipboard } = setup();

    const header = clipboard
      .toDelimitedText({ columns: ['price', 'nonexistent', 'instrument'] })
      .split('\n')[0];

    expect(header).toBe('Price,Instrument');
  });
});
