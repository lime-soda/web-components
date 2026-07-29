import { describe, expect, it, vi } from 'vitest';
import { resolveColumns } from '../../columns/resolve-columns.js';
import { GridPipeline } from '../../pipeline/grid-pipeline.js';
import { ModuleRegistry } from '../module-registry.js';
import { TreeModule } from '../tree/tree-module.js';
import { KeyboardModule, type SkipRowParams } from './keyboard-module.js';

/**
 * Passing over rows the consumer does not want to land on.
 *
 * The predicate always comes from the consumer. This module has no notion of a
 * group row, and a `skipGroupRows` flag would give it one — it would have to
 * read `meta.depth` or `meta.isGroup`, conventions owned by whichever module
 * built the hierarchy.
 */

interface Row {
  id: string;
  parentId: string | null;
  name: string;
}

/** Two groups of four instruments each, as a tree module would project them. */
const tree: Row[] = [
  { id: 'g0', parentId: null, name: 'Gilts' },
  ...Array.from({ length: 4 }, (_, i) => ({ id: `g0-i${i}`, parentId: 'g0', name: `A${i}` })),
  { id: 'g1', parentId: null, name: 'Bunds' },
  ...Array.from({ length: 4 }, (_, i) => ({ id: `g1-i${i}`, parentId: 'g1', name: `B${i}` })),
];

const setup = (
  skipRow?: (params: SkipRowParams<Row>) => boolean,
  data: Row[] = tree,
  rowsPerInstance = 20,
) => {
  const pipeline = new GridPipeline<Row>({
    getRowId: (d) => d.id,
    viewport: {
      width: 900,
      height: rowsPerInstance * 32 + 40,
      rowHeight: 32,
      headerHeight: 40,
      instanceWidth: 300,
      instanceGap: 0,
    },
  });
  pipeline.store.setRowData(data);

  const keyboard = new KeyboardModule<Row>(skipRow ? { skipRow } : {});
  const registry = new ModuleRegistry<Row>({
    pipeline,
    getColumns: () => resolveColumns<Row>([{ field: 'name' }, { colId: 'b' }]),
    dispatch: vi.fn(),
  });
  registry.register(
    new TreeModule<Row>({ getParentId: (row) => row.parentId, defaultExpanded: true }),
  );
  registry.register(keyboard);
  registry.start();
  pipeline.projector.rows.get();
  return { registry, keyboard, focus: registry.focus, pipeline };
};

const press = (
  registry: ModuleRegistry<Row>,
  key: string,
  modifiers: Partial<KeyboardEvent> = {},
) => registry.handleKeyDown({ key, ...modifiers } as KeyboardEvent);

const rowAt = (focus: ReturnType<typeof setup>['focus']) => focus.focused.get()?.rowKey ?? null;

/**
 * What a consumer would write to skip group headings.
 *
 * `hasChildren` is the tree module's convention, not something the keyboard
 * module knows — which is the whole reason the predicate comes from outside.
 */
const isGroup = ({ meta }: SkipRowParams<Row>) => meta['hasChildren'] === true;

describe('skipRow', () => {
  it('is off unless the consumer supplies a predicate', () => {
    const { registry, focus } = setup();

    press(registry, 'ArrowDown');

    // The first row is a group heading, and without a predicate it is a
    // perfectly ordinary place to be.
    expect(rowAt(focus)).toBe('g0');
  });

  it('passes over a skipped row on the way down', () => {
    const { registry, focus } = setup(isGroup);

    press(registry, 'ArrowDown');

    expect(rowAt(focus)).toBe('g0-i0');
  });

  it('passes over a skipped row on the way up', () => {
    const { registry, focus } = setup(isGroup);
    for (let i = 0; i < 5; i += 1) press(registry, 'ArrowDown');
    expect(rowAt(focus)).toBe('g1-i0');

    press(registry, 'ArrowUp');

    // Straight past the 'g1' heading to the last instrument above it.
    expect(rowAt(focus)).toBe('g0-i3');
  });

  it('is given the row id, its meta and its data', () => {
    const seen: SkipRowParams<Row>[] = [];
    const { registry } = setup((params) => {
      seen.push(params);
      return false;
    });

    press(registry, 'ArrowDown');

    expect(seen[0]).toMatchObject({ rowId: 'g0' });
    expect(seen[0]?.meta).toHaveProperty('depth');
    expect(seen[0]?.node?.data.name).toBe('Gilts');
  });

  it('leaves movement along a row alone, since it cannot change row', () => {
    const { registry, focus } = setup(isGroup);
    press(registry, 'ArrowDown');
    const before = rowAt(focus);

    expect(press(registry, 'ArrowRight')).toBe(true);

    expect(rowAt(focus)).toBe(before);
  });

  it('never offers a header, which is not a row', () => {
    const skip = vi.fn(() => false);
    const { registry, focus } = setup(skip);
    press(registry, 'ArrowDown');
    skip.mockClear();

    press(registry, 'ArrowUp'); // into the header
    expect(focus.focused.get()?.section).toBe('header');

    expect(skip).not.toHaveBeenCalled();
  });

  it('refuses the move and stays put when everything ahead is skipped', () => {
    const { registry, focus } = setup(() => true);
    press(registry, 'ArrowDown');
    const before = focus.focused.get();

    expect(press(registry, 'ArrowDown')).toBe(false);

    // Not left halfway through the rows it rejected.
    expect(focus.focused.get()).toEqual(before);
  });

  it('settles onto a real row when entering the grid', () => {
    const { registry, focus } = setup(isGroup);

    press(registry, 'ArrowDown');

    expect(rowAt(focus)).not.toBe('g0');
  });

  it('settles after an instance jump', () => {
    // Five rows per instance, so instance 1 starts on the 'g1' heading.
    const { registry, focus } = setup(isGroup, tree, 5);
    press(registry, 'ArrowDown');

    press(registry, 'PageDown');

    const landed = rowAt(focus);
    expect(landed).not.toBeNull();
    expect(landed).not.toBe('g1');
    expect(landed).not.toBe('g0');
  });

  it('can be changed at runtime', () => {
    const { registry, keyboard, focus } = setup();
    press(registry, 'ArrowDown');
    expect(rowAt(focus)).toBe('g0');

    keyboard.setOptions({ skipRow: isGroup });
    press(registry, 'ArrowDown');

    expect(rowAt(focus)).toBe('g0-i0');
  });
});
