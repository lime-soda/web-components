import { afterEach, describe, expect, it } from 'vitest';
import { defineElements } from '../define-elements.js';
import { SelectionModule } from '../modules/selection/index.js';
import { KeyboardModule } from '../modules/keyboard/index.js';
import type { FlowGrid } from './grid.js';
import type { GridOptions } from '../api/types.js';

/**
 * Reaching a cell with the mouse, and acting on it with the keyboard.
 *
 * Both were broken in ways the unit tests could not see: the focus ring was
 * `:focus-visible`, which by design never matches a mouse click, so a clicked
 * cell was genuinely focused and looked exactly like an unfocused one; and a
 * focused cell had no way to select its row, because focus sits on the cell
 * rather than on the checkbox inside it.
 */

interface Row {
  id: string;
  name: string;
  price: number;
}

const data: Row[] = Array.from({ length: 8 }, (_, i) => ({
  id: `r${i}`,
  name: `Row ${i}`,
  price: i,
}));

let host: HTMLDivElement | undefined;

defineElements();

async function waitFor(condition: () => boolean, timeout = 2000): Promise<void> {
  const start = performance.now();
  while (!condition()) {
    if (performance.now() - start > timeout) throw new Error('timed out');
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
}

async function mount(): Promise<FlowGrid<Row>> {
  host = document.createElement('div');
  host.style.height = '400px';
  host.style.width = '600px';
  document.body.append(host);

  const grid = document.createElement('flow-grid') as FlowGrid<Row>;
  grid.style.height = '100%';
  grid.gridOptions = {
    columns: [
      { field: 'name', width: 200 },
      { field: 'price', width: 100 },
    ],
    getRowId: (row) => row.id,
    modules: [new SelectionModule<Row>({ mode: 'multi' }), new KeyboardModule<Row>()],
  } satisfies GridOptions<Row>;
  grid.rowData = data;
  host.append(grid);

  await waitFor(() => cells(grid).length > 0);
  return grid;
}

const cells = (grid: FlowGrid<Row>): HTMLElement[] => {
  const instance = grid.shadowRoot?.querySelector('flow-instance');
  return [...(instance?.shadowRoot?.querySelectorAll('flow-row') ?? [])].flatMap((row) => [
    ...((row as HTMLElement & { shadowRoot: ShadowRoot }).shadowRoot?.querySelectorAll(
      'flow-cell',
    ) ?? []),
  ]) as HTMLElement[];
};

afterEach(() => {
  host?.remove();
  host = undefined;
});

describe('focusing a cell with the mouse', () => {
  it('tells the grid where focus is', async () => {
    const grid = await mount();
    const cell = cells(grid)[5]!;

    cell.focus();
    await waitFor(() => grid.controller.focus.focused.get() !== null);

    expect(grid.controller.focus.focused.get()).not.toBeNull();
  });

  it('shows a focus ring, which :focus-visible would not have done', async () => {
    // The regression this file exists for. A mouse click focuses the cell but
    // never matches :focus-visible, so the ring has to come from the grid's own
    // focus state instead.
    const grid = await mount();
    const cell = cells(grid)[5]!;

    cell.focus();
    await waitFor(() => cell.hasAttribute('data-focused'));

    expect(getComputedStyle(cell).outlineStyle).toBe('solid');
    expect(getComputedStyle(cell).outlineWidth).not.toBe('0px');
  });

  it('moves the ring off the cell that had it', async () => {
    const grid = await mount();
    const [first, , third] = cells(grid);

    first!.focus();
    await waitFor(() => first!.hasAttribute('data-focused'));
    third!.focus();
    await waitFor(() => third!.hasAttribute('data-focused'));

    expect(first!.hasAttribute('data-focused')).toBe(false);
  });
});

describe('selecting from the keyboard', () => {
  const press = (grid: FlowGrid<Row>, key: string) => {
    const target = cells(grid).find((cell) => cell.hasAttribute('data-focused')) ?? grid;
    const event = new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    target.dispatchEvent(event);
    return event;
  };

  it('selects the focused row with Space', async () => {
    const grid = await mount();
    cells(grid)[2]!.focus();
    await waitFor(() => grid.controller.focus.focused.get() !== null);

    press(grid, ' ');

    expect(grid.api.getSelectedCount()).toBe(1);
  });

  it('selects with Enter too', async () => {
    const grid = await mount();
    cells(grid)[2]!.focus();
    await waitFor(() => grid.controller.focus.focused.get() !== null);

    press(grid, 'Enter');

    expect(grid.api.getSelectedCount()).toBe(1);
  });

  it('toggles, so a second press deselects', async () => {
    const grid = await mount();
    cells(grid)[2]!.focus();
    await waitFor(() => grid.controller.focus.focused.get() !== null);

    press(grid, ' ');
    press(grid, ' ');

    expect(grid.api.getSelectedCount()).toBe(0);
  });

  it('stops Space scrolling the page', async () => {
    const grid = await mount();
    cells(grid)[2]!.focus();
    await waitFor(() => grid.controller.focus.focused.get() !== null);

    const event = press(grid, ' ');

    expect(event.defaultPrevented).toBe(true);
  });

  it('works from any column, not only the checkbox one', async () => {
    const grid = await mount();
    // Third column of the second row: a value cell, nowhere near a checkbox.
    const valueCell = cells(grid)[5]!;
    valueCell.focus();
    await waitFor(() => grid.controller.focus.focused.get() !== null);

    press(grid, ' ');

    expect(grid.api.getSelectedCount()).toBe(1);
  });

  it('does nothing when no cell is focused', async () => {
    const grid = await mount();

    const event = new KeyboardEvent('keydown', {
      key: ' ',
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    grid.dispatchEvent(event);

    expect(grid.api.getSelectedCount()).toBe(0);
  });
});
