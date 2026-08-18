import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect } from 'storybook/test';
import { html, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import { CellRendererElement } from '@lime-soda/grid';
import type { Grid } from '@lime-soda/grid';
import '@lime-soda/grid';
import '@lime-soda/grid/layouts';
import { cellText, cellsOf, dataRows, gridReady, queryAllByRole } from './shadow-queries.js';
import {
  type Instrument,
  columns,
  instruments,
  mountGrid,
  testStoryParameters,
} from './fixtures.js';

/**
 * What a cell ends up showing, and what a grid shows with nothing installed.
 *
 * The value path is `valueGetter` → `valueFormatter` → `cellRenderer`, and a
 * renderer is a custom element that reads what it needs from context rather
 * than being handed props. None of that is visible from the outside except in
 * the one place it matters: the text in the cell.
 */

const data = instruments(6);

const meta: Meta = {
  title: 'Grid/Tests/Rendering',
  parameters: testStoryParameters,
  render: () =>
    mountGrid({
      data,
      height: 300,
      options: {
        columns: [
          columns[0]!,
          { ...columns[1]!, valueFormatter: ({ value }) => (value as number).toFixed(2) },
        ],
      },
    }),
};

export default meta;
type Story = StoryObj;

const firstRowCells = (canvas: HTMLElement) => cellsOf(dataRows(canvas)[0]!);

export const AFormatterDecidesWhatTheCellSays: Story = {
  play: async ({ canvasElement }) => {
    // The raw value is 100; the column shows two decimal places, and a paste
    // into a spreadsheet should match what was read.
    await gridReady(canvasElement);

    await expect(cellText(firstRowCells(canvasElement)[1]!)).toBe('100.00');
  },
};

export const ARendererReadsItsValueFromContext: Story = {
  render: () =>
    mountGrid({
      data,
      height: 300,
      options: { columns: [columns[0]!, { ...columns[1]!, cellRenderer: 'test-price-tag' }] },
    }),
  play: async ({ canvasElement }) => {
    // The renderer is handed no props: it consumes the row and column contexts
    // the cell already provides, which is what lets it hold its own state.
    await gridReady(canvasElement);

    await expect(cellText(firstRowCells(canvasElement)[1]!)).toContain('100');
  },
};

export const ATickRepaintsOnlyTheCell: Story = {
  play: async ({ canvasElement }) => {
    // A price moving is the common case, and the reason the grid keeps a signal
    // per row: the new value has to appear without the projection or the layout
    // running again. Only the first half is visible here; the second is a
    // budget, and lives in the benchmarks.
    await gridReady(canvasElement);
    const grid = canvasElement.querySelector('ls-grid') as Grid<Instrument>;
    await expect(cellText(firstRowCells(canvasElement)[1]!)).toBe('100.00');

    grid.api.applyTransaction({
      update: [{ id: 'i0', parentId: null, name: 'INS 0', price: 999, size: 1000 }],
    });
    await gridReady(canvasElement);

    await expect(cellText(firstRowCells(canvasElement)[1]!)).toBe('999.00');
  },
};

export const NothingInstalledStillDrawsAGrid: Story = {
  render: () => mountGrid({ data, height: 300 }),
  play: async ({ canvasElement }) => {
    await gridReady(canvasElement);

    await expect(dataRows(canvasElement).length).toBeGreaterThan(0);
    await expect(queryAllByRole(canvasElement, 'gridcell').length).toBeGreaterThan(0);
  },
};

export const NothingInstalledOffersNoAffordances: Story = {
  render: () => mountGrid({ data, height: 300 }),
  play: async ({ canvasElement }) => {
    // No expander, no checkbox, no sort control. A grid that draws controls for
    // features it does not have is offering something it cannot do.
    await gridReady(canvasElement);

    await expect(queryAllByRole(canvasElement, 'button')).toHaveLength(0);
    await expect(queryAllByRole(canvasElement, 'checkbox')).toHaveLength(0);
    await expect(queryAllByRole(canvasElement, 'searchbox')).toHaveLength(0);
  },
};

/** A renderer that reads its value from context rather than from props. */
@customElement('test-price-tag')
export class TestPriceTag extends CellRendererElement<Instrument, number> {
  override render(): unknown {
    return this.value === undefined ? nothing : html`<span>${this.value}</span>`;
  }
}
