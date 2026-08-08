import { describe, expect, it, vi } from 'vite-plus/test';
import { resolveColumns } from '../../columns/resolve-columns.js';
import { GridPipeline } from '../../pipeline/grid-pipeline.js';
import { ModuleRegistry } from '../module-registry.js';
import { KeyboardModule, type SkipRowParams } from './keyboard-module.js';

/**
 * Tab through the grid.
 *
 * The grid is a single tab stop, which is what lets a keyboard reach it at all
 * — but Tab then has to move between cells rather than straight back out, and
 * has to run out at the ends so it is possible to leave.
 */

interface Row {
  id: string;
}

const setup = (rowCount = 25, skipRow?: (params: SkipRowParams<Row>) => boolean) => {
  const pipeline = new GridPipeline<Row>({
    getRowId: (d) => d.id,
    viewport: {
      width: 900,
      height: 360,
      rowHeight: 32,
      headerHeight: 40,
      instanceWidth: 300,
      instanceGap: 0,
    },
  });
  pipeline.store.setRowData(Array.from({ length: rowCount }, (_, i) => ({ id: `r${i}` })));

  const keyboard = new KeyboardModule<Row>(skipRow ? { skipRow } : {});
  const registry = new ModuleRegistry<Row>({
    pipeline,
    getColumns: () => resolveColumns<Row>([{ field: 'id' }, { colId: 'b' }, { colId: 'c' }]),
    dispatch: vi.fn(),
  });
  registry.register(keyboard);
  registry.start();
  return { registry, focus: registry.focus, pipeline };
};

const tab = (registry: ModuleRegistry<Row>, shiftKey = false) =>
  registry.handleKeyDown({ key: 'Tab', shiftKey } as KeyboardEvent);

const at = (focus: ReturnType<typeof setup>['focus']) => {
  const p = focus.focused.get();
  return p === null ? null : `${p.instanceId}/${p.section}/${p.rowKey}/${p.colId}`;
};

describe('tabbing', () => {
  it('moves along the row', () => {
    const { registry, focus } = setup();
    focus.focusFirst();

    expect(tab(registry)).toBe(true);

    expect(at(focus)).toBe('instance-0/body/r0/b');
  });

  it('wraps to the start of the next row at the end of one', () => {
    const { registry, focus } = setup();
    focus.focusFirst();
    tab(registry);
    tab(registry); // last column of r0

    expect(tab(registry)).toBe(true);

    expect(at(focus)).toBe('instance-0/body/r1/id');
  });

  it('goes back along the row with shift', () => {
    const { registry, focus } = setup();
    focus.focusFirst();
    tab(registry);

    expect(tab(registry, true)).toBe(true);

    expect(at(focus)).toBe('instance-0/body/r0/id');
  });

  it('wraps back to the end of the previous row', () => {
    const { registry, focus } = setup();
    focus.focus({ instanceId: 'instance-0', rowKey: 'r1', colId: 'id', section: 'body' });

    expect(tab(registry, true)).toBe(true);

    expect(at(focus)).toBe('instance-0/body/r0/c');
  });

  it('reaches the header above the first row, going back', () => {
    const { registry, focus } = setup();
    focus.focusFirst();

    expect(tab(registry, true)).toBe(true);

    expect(at(focus)).toBe('instance-0/header//c');
  });

  it('comes out of a header into the rows it heads', () => {
    const { registry, focus } = setup();
    focus.focusHeader('instance-0', 'c');

    expect(tab(registry)).toBe(true);

    expect(at(focus)).toBe('instance-0/body/r0/id');
  });

  it('carries on into the next instance', () => {
    const { registry, focus, pipeline } = setup();
    const first = pipeline.layout.get().instances[0]!;
    const lastRow = first.rows[first.rows.length - 1]!;
    focus.focus({ instanceId: first.id, rowKey: lastRow.id, colId: 'c', section: 'body' });

    expect(tab(registry)).toBe(true);

    // Reading order puts the next instance's header first.
    expect(at(focus)).toBe('instance-1/header//id');
  });

  describe('leaving the grid', () => {
    /**
     * Refusing to move is what lets Tab out: the key goes unhandled, so the
     * browser moves focus onward instead of the grid swallowing it.
     */
    it('gives up at the very end', () => {
      const { registry, focus, pipeline } = setup();
      const instances = pipeline.layout.get().instances;
      const last = instances[instances.length - 1]!;
      focus.focus({
        instanceId: last.id,
        rowKey: last.rows[last.rows.length - 1]!.id,
        colId: 'c',
        section: 'body',
      });

      expect(tab(registry)).toBe(false);
    });

    it('gives up at the very start', () => {
      const { registry, focus } = setup();
      focus.focusHeader('instance-0', 'id');

      expect(tab(registry, true)).toBe(false);
    });

    it('leaves focus where it was when it gives up', () => {
      const { registry, focus } = setup();
      focus.focusHeader('instance-0', 'id');
      const before = focus.focused.get();

      tab(registry, true);

      expect(focus.focused.get()).toEqual(before);
    });
  });

  it('reaches rows the arrows are told to skip', () => {
    // `skipRow` says where the arrows come to rest. A row Tab could not reach
    // would be a row no keyboard could reach.
    const skipOddRows = ({ rowId }: SkipRowParams<Row>) => Number(rowId.slice(1)) % 2 === 1;
    const { registry, focus } = setup(25, skipOddRows);
    focus.focus({ instanceId: 'instance-0', rowKey: 'r0', colId: 'c', section: 'body' });

    expect(tab(registry)).toBe(true);

    expect(at(focus)).toBe('instance-0/body/r1/id');
  });
});
