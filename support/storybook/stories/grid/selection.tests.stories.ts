import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect, userEvent } from 'storybook/test';
import { html } from 'lit';
import type { GridOptions } from '@lime-soda/grid';
import '@lime-soda/grid';
import '@lime-soda/grid/layouts';
import { SelectionModule } from '@lime-soda/grid/selection';
import { KeyboardModule } from '@lime-soda/grid/keyboard';
import { cellsOf, dataRows, getAllByRole, gridReady, pressKey } from './shadow-queries.js';

/**
 * Picking rows, with the mouse and from the keyboard.
 *
 * Selection is a module: a grid without it has no checkbox column, no highlight
 * and no meaning for Space. Everything here is that module's, which is why it
 * is not in the cell-focus stories next door — those own where focus is, and
 * for a while they owned this too, which left neither able to say what it was
 * really testing.
 *
 * What a row reports about itself is the assertion throughout. `aria-selected`
 * and the checkbox's own label are what a screen reader is told, so a
 * regression that keeps the module's state right while telling the user nothing
 * still fails.
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
  mode: 'single' | 'multi';
}

const meta: Meta<Args> = {
  title: 'Grid/Tests/Selection',
  parameters: {
    layout: 'centered',
    chromatic: { disableSnapshot: true },
    docs: { disable: true },
    a11y: { test: 'error' },
  },
  args: { checkboxColumn: true, mode: 'multi' },
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
        new SelectionModule<Row>({ mode: args.mode, checkboxColumn: args.checkboxColumn }),
        new KeyboardModule<Row>(),
      ],
    };
    return html`
      <div style="width:420px;height:236px">
        <ls-grid .gridOptions=${options} .rowData=${data} style="height:100%"></ls-grid>
      </div>
    `;
  },
};

export default meta;
type Story = StoryObj<Args>;

const settled = (canvas: HTMLElement) => gridReady(canvas);

const selectedRows = (canvas: HTMLElement) =>
  dataRows(canvas).filter((row) => row.getAttribute('aria-selected') === 'true');

const cellAt = (canvas: HTMLElement, row: number, column: number) =>
  cellsOf(dataRows(canvas)[row]!)[column]!;

const checkboxes = (canvas: HTMLElement) => getAllByRole(canvas, 'checkbox');

// --- with the mouse ---------------------------------------------------------

export const TickingACheckboxSelectsItsRow: Story = {
  play: async ({ canvasElement }) => {
    await settled(canvasElement);
    // The header's checkbox is first; the rows' follow.
    const row = checkboxes(canvasElement)[1]!;

    await userEvent.click(row);

    await expect(selectedRows(canvasElement)).toHaveLength(1);
    // The control renames itself, which is what a screen reader reads back.
    await expect(row.getAttribute('aria-label')).toBe('Deselect');
  },
};

export const TickingAgainDeselects: Story = {
  play: async ({ canvasElement }) => {
    await settled(canvasElement);
    const row = checkboxes(canvasElement)[1]!;

    await userEvent.click(row);
    await userEvent.click(row);

    await expect(selectedRows(canvasElement)).toHaveLength(0);
    await expect(row.getAttribute('aria-label')).toBe('Select');
  },
};

export const SingleModeKeepsOneRow: Story = {
  args: { mode: 'single' },
  play: async ({ canvasElement }) => {
    await settled(canvasElement);

    await userEvent.click(checkboxes(canvasElement)[1]!);
    await userEvent.click(checkboxes(canvasElement)[2]!);

    await expect(selectedRows(canvasElement)).toHaveLength(1);
  },
};

// --- from the keyboard ------------------------------------------------------

export const SpaceSelectsTheFocusedRow: Story = {
  play: async ({ canvasElement }) => {
    // Focus sits on the cell, not on the checkbox inside it, so without this a
    // keyboard user has no way to select at all.
    await settled(canvasElement);
    await userEvent.click(cellAt(canvasElement, 1, 0));

    await pressKey(' ');

    await expect(selectedRows(canvasElement)).toHaveLength(1);
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
    // page jumping every time a trader picks a row.
    await settled(canvasElement);
    await userEvent.click(cellAt(canvasElement, 1, 0));

    await expect(await pressKey(' ')).toBe(true);
  },
};

export const SpaceBelongsToTheCheckboxColumnWhenThereIsOne: Story = {
  play: async ({ canvasElement }) => {
    // With the column present it owns selection, so Space in a value cell is
    // free for whatever a later module wants of it.
    await settled(canvasElement);
    await userEvent.click(cellAt(canvasElement, 1, 2));

    await pressKey(' ');

    await expect(selectedRows(canvasElement)).toHaveLength(0);
  },
};

export const SpaceWorksAnywhereWithoutACheckboxColumn: Story = {
  args: { checkboxColumn: false },
  play: async ({ canvasElement }) => {
    // Nothing else Space could mean here, and a keyboard user would otherwise
    // have no way to select.
    await settled(canvasElement);
    await userEvent.click(cellAt(canvasElement, 1, 1));

    await pressKey(' ');

    await expect(selectedRows(canvasElement)).toHaveLength(1);
  },
};
