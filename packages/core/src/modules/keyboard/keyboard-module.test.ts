import { describe, expect, it } from 'vitest';
import { resolveColumns } from '../../columns/resolve-columns.js';
import { GridPipeline } from '../../pipeline/grid-pipeline.js';
import { ModuleRegistry } from '../module-registry.js';
import { KeyboardModule, type KeyboardModuleOptions } from './keyboard-module.js';

interface Row {
  id: string;
}

const setup = (options: KeyboardModuleOptions = {}) => {
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
  pipeline.store.setRowData(Array.from({ length: 25 }, (_, i) => ({ id: `r${i}` })));

  const keyboard = new KeyboardModule<Row>(options);
  const registry = new ModuleRegistry<Row>({
    pipeline,
    getColumns: () => resolveColumns<Row>([{ field: 'id' }, { colId: 'b' }, { colId: 'c' }]),
    dispatch: () => {},
  });
  registry.register(keyboard);
  registry.start();
  return { registry, keyboard, focus: registry.focus };
};

const press = (
  registry: ModuleRegistry<Row>,
  key: string,
  modifiers: Partial<KeyboardEvent> = {},
) => registry.handleKeyDown({ key, ...modifiers } as KeyboardEvent);

const at = (focus: ReturnType<typeof setup>['focus']) => {
  const position = focus.focused.get();
  return position === null ? null : `${position.instanceId}/${position.rowKey}/${position.colId}`;
};

describe('KeyboardModule', () => {
  it('enters the grid on the first navigation key', () => {
    const { registry, focus } = setup();

    expect(press(registry, 'ArrowDown')).toBe(true);
    expect(at(focus)).toBe('instance-0/r0/id');
  });

  it('ignores a key that is not navigation when nothing is focused', () => {
    const { registry, focus } = setup();

    expect(press(registry, 'a')).toBe(false);
    expect(focus.focused.get()).toBeNull();
  });

  it('moves with the arrow keys', () => {
    const { registry, focus } = setup();
    press(registry, 'ArrowDown');

    press(registry, 'ArrowDown');
    expect(at(focus)).toBe('instance-0/r1/id');

    press(registry, 'ArrowRight');
    expect(at(focus)).toBe('instance-0/r1/b');

    press(registry, 'ArrowUp');
    expect(at(focus)).toBe('instance-0/r0/b');

    press(registry, 'ArrowLeft');
    expect(at(focus)).toBe('instance-0/r0/id');
  });

  it('jumps an instance with ctrl and an arrow', () => {
    const { registry, focus } = setup();
    press(registry, 'ArrowDown');

    press(registry, 'ArrowRight', { ctrlKey: true });

    expect(at(focus)).toBe('instance-1/r10/id');
  });

  it('jumps an instance with cmd on a Mac', () => {
    const { registry, focus } = setup();
    press(registry, 'ArrowDown');

    press(registry, 'ArrowRight', { metaKey: true });

    expect(at(focus)).toBe('instance-1/r10/id');
  });

  it('moves by column instead when instanceJump is off', () => {
    const { registry, focus } = setup({ instanceJump: false });
    press(registry, 'ArrowDown');

    press(registry, 'ArrowRight', { ctrlKey: true });

    expect(at(focus)).toBe('instance-0/r0/b');
  });

  it('pages by instance, because an instance is exactly a viewport of rows', () => {
    const { registry, focus } = setup();
    press(registry, 'ArrowDown');

    press(registry, 'PageDown');
    expect(at(focus)).toBe('instance-1/r10/id');

    press(registry, 'PageUp');
    expect(at(focus)).toBe('instance-0/r0/id');
  });

  it('moves to the ends of a row with Home and End', () => {
    const { registry, focus } = setup();
    press(registry, 'ArrowDown');

    press(registry, 'End');
    expect(at(focus)).toBe('instance-0/r0/c');

    press(registry, 'Home');
    expect(at(focus)).toBe('instance-0/r0/id');
  });

  it('moves to the ends of the grid with ctrl Home and End', () => {
    const { registry, focus } = setup();
    press(registry, 'ArrowDown');

    press(registry, 'End', { ctrlKey: true });
    expect(at(focus)).toBe('instance-2/r24/id');

    press(registry, 'Home', { ctrlKey: true });
    expect(at(focus)).toBe('instance-0/r0/id');
  });

  it('releases focus on Escape, so Tab leaves the grid', () => {
    const { registry, focus } = setup();
    press(registry, 'ArrowDown');

    expect(press(registry, 'Escape')).toBe(true);
    expect(focus.focused.get()).toBeNull();
  });

  it('reports a key it did not handle, so the page keeps its own shortcuts', () => {
    const { registry } = setup();
    press(registry, 'ArrowDown');

    expect(press(registry, 'k')).toBe(false);
  });

  it('reports unhandled when a move is refused at an edge', () => {
    const { registry } = setup();
    press(registry, 'ArrowDown');

    expect(press(registry, 'ArrowUp')).toBe(false);
  });

  it('does nothing at all when the module is not registered', () => {
    const pipeline = new GridPipeline<Row>({ getRowId: (d) => d.id });
    const registry = new ModuleRegistry<Row>({
      pipeline,
      getColumns: () => [],
      dispatch: () => {},
    });
    registry.start();

    expect(registry.handleKeyDown({ key: 'ArrowDown' } as KeyboardEvent)).toBe(false);
  });
});
