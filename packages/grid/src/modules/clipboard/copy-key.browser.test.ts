import { describe, expect, it } from 'vite-plus/test';
import { resolveColumns } from '../../columns/resolve-columns.js';
import { GridPipeline } from '../../pipeline/grid-pipeline.js';
import { ModuleRegistry } from '../module-registry.js';
import { ClipboardModule } from './clipboard-module.js';

/**
 * Which key presses the module claims.
 *
 * In the browser project because it needs real KeyboardEvents and a real
 * element to stand in for a filter input — `composedPath` and `instanceof
 * HTMLInputElement` are the whole mechanism being checked, and neither survives
 * a stub.
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

const setup = () => {
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
  registry.register(clipboard);
  registry.start();
  pipeline.projector.rows.get();

  return { clipboard, registry, pipeline };
};

describe('the copy key', () => {
  const press = (module: ClipboardModule<Bond>, init: KeyboardEventInit, target?: EventTarget) => {
    const event = new KeyboardEvent('keydown', { key: 'c', ...init });
    if (target) Object.defineProperty(event, 'composedPath', { value: () => [target] });
    return module.onKeyDown(event);
  };

  it('claims Ctrl-C and Cmd-C, and nothing else', () => {
    const { clipboard } = setup();

    expect(press(clipboard, { ctrlKey: true })).toBe(true);
    expect(press(clipboard, { metaKey: true })).toBe(true);
    expect(press(clipboard, {})).toBe(false);
  });

  it('leaves the key alone inside an input', () => {
    // A filter input, or later a cell editor: the user means the text they
    // selected, not the grid.
    const { clipboard } = setup();

    expect(press(clipboard, { ctrlKey: true }, document.createElement('input'))).toBe(false);
  });

  it('can be told not to bind the key at all', () => {
    const { clipboard } = setup();
    clipboard.setOptions({ copyOnKeyboard: false });

    expect(press(clipboard, { ctrlKey: true })).toBe(false);
  });
});
