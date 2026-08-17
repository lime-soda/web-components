import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect, userEvent } from 'storybook/test';
import { html } from 'lit';
import type { GridOptions } from '@lime-soda/grid';
import '@lime-soda/grid';
import '@lime-soda/grid/layouts';
import { SelectionModule } from '@lime-soda/grid/selection';
import { KeyboardModule } from '@lime-soda/grid/keyboard';
import {
  activeElement,
  cellsOf,
  dataRows,
  findAllByRole,
  getAllByRole,
  pressKey,
  queryAllByRole,
  tabInto,
} from './shadow-queries.js';

/**
 * Reaching a cell with the mouse, and acting on it with the keyboard.
 *
 * Both were once broken in ways no unit test could see. The focus ring was
 * `:focus-visible`, which by design never matches a mouse click, so a clicked
 * cell was genuinely focused and looked exactly like an unfocused one. And a
 * focused cell had no way to select its row, because focus sits on the cell
 * rather than on the checkbox inside it.
 */

interface Row {
  id: string;
  name: string;
  price: number;
}

const data: Row[] = Array.from({ length: 5 }, (_, i) => ({
  id: `r${i}`,
  name: `Row ${i}`,
  price: i,
}));

interface Args {
  checkboxColumn: boolean;
}

const meta: Meta<Args> = {
  title: 'Grid/Tests/Cell focus',
  parameters: {
    layout: 'fullscreen',
    // Snapshots on, unlike the other test stories: the defect these exist for
    // is a cell that holds focus and looks like it does not, and that is a
    // question about pixels. Each story ends on a settled, deterministic state
    // — a cell focused, a row selected — so the image is worth diffing.
    chromatic: {},
    docs: { disable: true },
    a11y: { test: 'error' },
  },
  args: { checkboxColumn: true },
  render: (args) => {
    const options: GridOptions<Row> = {
      columns: [
        { field: 'name', headerName: 'Name', width: 200 },
        { field: 'price', headerName: 'Price', width: 120 },
      ],
      getRowId: (row) => row.id,
      layout: 'stack',
      rowHeight: 32,
      headerHeight: 40,
      modules: [
        new SelectionModule<Row>({ mode: 'multi', checkboxColumn: args.checkboxColumn }),
        new KeyboardModule<Row>(),
      ],
    };
    return html`
      <div style="width:600px;height:280px">
        <ls-grid .gridOptions=${options} .rowData=${data} style="height:100%"></ls-grid>
      </div>
      <button id="elsewhere">Elsewhere</button>
    `;
  },
};

export default meta;
type Story = StoryObj<Args>;

const settled = (canvas: HTMLElement) => findAllByRole(canvas, 'gridcell');

const rowAt = (canvas: HTMLElement, index: number) => dataRows(canvas)[index]!;
const cellAt = (canvas: HTMLElement, row: number, column: number) =>
  cellsOf(rowAt(canvas, row))[column]!;

/**
 * The cell the grid would hand focus to on Tab.
 *
 * The roving tabindex is the ARIA grid pattern: exactly one cell is the tab
 * stop and the rest are -1, which is how a browser and a screen reader both
 * find their way back in. It is the grid's remembered position, stated in the
 * DOM rather than in an attribute of the grid's own invention.
 */
const tabStops = (canvas: HTMLElement) =>
  getAllByRole(canvas, 'gridcell').filter((cell) => cell.getAttribute('tabindex') === '0');

const selectedRows = (canvas: HTMLElement) =>
  dataRows(canvas).filter((row) => row.getAttribute('aria-selected') === 'true');

// --- the mouse -------------------------------------------------------------

export const ClickingACellFocusesIt: Story = {
  play: async ({ canvasElement }) => {
    // `:focus-visible` never matches a click, so this looked identical to an
    // unfocused cell while genuinely holding focus.
    await settled(canvasElement);
    const cell = cellAt(canvasElement, 1, 1);

    await userEvent.click(cell);

    // Focus itself, and the tab stop moving with it. Whether a ring is drawn is
    // Chromatic's to judge; this story is the interaction that puts the grid in
    // the state worth photographing.
    await expect(activeElement()).toBe(cell);
    await expect(tabStops(canvasElement)).toEqual([cell]);
  },
};

export const ClickingElsewhereMovesFocus: Story = {
  play: async ({ canvasElement }) => {
    await settled(canvasElement);
    const first = cellAt(canvasElement, 1, 1);
    const second = cellAt(canvasElement, 2, 1);

    await userEvent.click(first);
    await userEvent.click(second);

    await expect(activeElement()).toBe(second);
    await expect(tabStops(canvasElement)).toEqual([second]);
  },
};

// --- selecting from the keyboard -------------------------------------------

export const SpaceSelectsTheFocusedRow: Story = {
  play: async ({ canvasElement }) => {
    // Focus sits on the cell, not on the checkbox inside it, so the row had no
    // way to be selected from the keyboard at all.
    await settled(canvasElement);
    await userEvent.click(cellAt(canvasElement, 1, 0));

    await pressKey(' ');

    await expect(selectedRows(canvasElement)).toHaveLength(1);
    await expect(queryAllByRole(canvasElement, 'checkbox', { name: 'Deselect' })).toHaveLength(1);
  },
};

export const EnterSelectsTheFocusedRow: Story = {
  play: async ({ canvasElement }) => {
    await settled(canvasElement);
    await userEvent.click(cellAt(canvasElement, 1, 0));

    await pressKey('Enter');

    await expect(selectedRows(canvasElement)).toHaveLength(1);
  },
};

export const SpaceTogglesTheRowOffAgain: Story = {
  play: async ({ canvasElement }) => {
    await settled(canvasElement);
    await userEvent.click(cellAt(canvasElement, 1, 0));

    await pressKey(' ');
    await expect(selectedRows(canvasElement)).toHaveLength(1);

    await pressKey(' ');
    await expect(selectedRows(canvasElement)).toHaveLength(0);
  },
};

export const SpaceDoesNotScrollThePage: Story = {
  play: async ({ canvasElement }) => {
    // Space is the page-down of the web. Claiming it is what stops the whole
    // page jumping every time a trader selects a row.
    await settled(canvasElement);
    await userEvent.click(cellAt(canvasElement, 1, 0));

    await expect(await pressKey(' ')).toBe(true);
  },
};

export const SpaceIsTheCheckboxColumnsWhenThereIsOne: Story = {
  play: async ({ canvasElement }) => {
    // With a checkbox column present it owns selection, so Space in a value
    // cell is free for whatever a future module wants of it.
    await settled(canvasElement);
    await userEvent.click(cellAt(canvasElement, 1, 2));

    await pressKey(' ');

    await expect(selectedRows(canvasElement)).toHaveLength(0);
  },
};

export const SpaceWorksFromAnyCellWithoutACheckboxColumn: Story = {
  args: { checkboxColumn: false },
  play: async ({ canvasElement }) => {
    // Without the column there is nothing else Space could mean, and a keyboard
    // user would otherwise have no way to select at all.
    await settled(canvasElement);
    await userEvent.click(cellAt(canvasElement, 1, 1));

    await pressKey(' ');

    await expect(selectedRows(canvasElement)).toHaveLength(1);
  },
};

// --- focus leaving and coming back -----------------------------------------

export const FocusCanLeaveTheGrid: Story = {
  play: async ({ canvasElement }) => {
    // A remembered position is where Tab would return to, not somewhere that is
    // focused now — so the grid stops drawing on it.
    await settled(canvasElement);
    const cell = cellAt(canvasElement, 1, 1);
    await userEvent.click(cell);

    await userEvent.click(document.querySelector('#elsewhere') as HTMLElement);

    // Focus really left, and the grid kept the cell as its way back in.
    await expect(activeElement()).not.toBe(cell);
    await expect(tabStops(canvasElement)).toEqual([cell]);
  },
};

export const FocusComesBackToTheSameCell: Story = {
  play: async ({ canvasElement }) => {
    await settled(canvasElement);
    const cell = cellAt(canvasElement, 2, 1);
    await userEvent.click(cell);
    await userEvent.click(document.querySelector('#elsewhere') as HTMLElement);

    tabInto(canvasElement);

    // Focus itself, and the tab stop moving with it. Whether a ring is drawn is
    // Chromatic's to judge; this story is the interaction that puts the grid in
    // the state worth photographing.
    await expect(activeElement()).toBe(cell);
    await expect(tabStops(canvasElement)).toEqual([cell]);
  },
};

export const OneTabStopFollowsFocus: Story = {
  play: async ({ canvasElement }) => {
    await settled(canvasElement);
    const start = cellAt(canvasElement, 1, 1);
    await userEvent.click(start);

    await pressKey('ArrowDown');

    const now = activeElement()!;
    await expect(now).not.toBe(start);
    // One tab stop at a time. Two would leave a keyboard user re-entering the
    // grid somewhere they never were.
    await expect(tabStops(canvasElement)).toEqual([now]);
  },
};
