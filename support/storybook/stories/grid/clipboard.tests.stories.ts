import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect, userEvent } from 'storybook/test';
import '@lime-soda/grid';
import '@lime-soda/grid/layouts';
import { ClipboardModule } from '@lime-soda/grid/clipboard';
import { FilterModule } from '@lime-soda/grid/filter';
import { EditModule } from '@lime-soda/grid/edit';
import { RangeModule } from '@lime-soda/grid/range';
import type { Grid } from '@lime-soda/grid';
import {
  cellText,
  cellsOf,
  dataRows,
  getAllByRole,
  gridReady,
  pressKey,
} from './shadow-queries.js';
import { type Instrument, instruments, mountGrid, testStoryParameters } from './fixtures.js';

/**
 * Which key presses the grid takes, and which it leaves alone.
 *
 * Copying is the module's whole reason to exist, and the part that can go wrong
 * without anyone noticing is the second half: a filter input is a place where
 * Ctrl-C means the text the user selected, not the grid beneath it. Taking the
 * key there would quietly replace what they were copying.
 *
 * What is asserted is whether the grid claimed the press. Reading the system
 * clipboard back needs a permission the test browser will not grant, and the
 * text the module produces is fixed by its own unit tests — this is the half
 * those cannot see.
 */

const data = instruments(5);

const withClipboard = (options: ConstructorParameters<typeof ClipboardModule>[0] = {}) =>
  mountGrid({
    data,
    options: { layout: 'stack', modules: [new ClipboardModule<Instrument>(options)] },
    width: 500,
    height: 236,
  });

const meta: Meta = {
  title: 'Grid/Tests/Clipboard',
  parameters: testStoryParameters,
  render: () => withClipboard(),
};

export default meta;
type Story = StoryObj;

const firstCell = (canvas: HTMLElement) => cellsOf(dataRows(canvas)[0]!)[0]!;

export const CtrlCIsClaimed: Story = {
  play: async ({ canvasElement }) => {
    await gridReady(canvasElement);
    await userEvent.click(firstCell(canvasElement));

    await expect(await pressKey('c', { ctrlKey: true })).toBe(true);
  },
};

export const CmdCIsClaimed: Story = {
  play: async ({ canvasElement }) => {
    // macOS, where Cmd is the copy modifier.
    await gridReady(canvasElement);
    await userEvent.click(firstCell(canvasElement));

    await expect(await pressKey('c', { metaKey: true })).toBe(true);
  },
};

export const PlainCIsNot: Story = {
  play: async ({ canvasElement }) => {
    // A letter on its own belongs to whatever might type it later.
    await gridReady(canvasElement);
    await userEvent.click(firstCell(canvasElement));

    await expect(await pressKey('c')).toBe(false);
  },
};

export const CopyingInsideAFilterInputIsLeftAlone: Story = {
  render: () =>
    mountGrid({
      data,
      options: {
        layout: 'stack',
        modules: [
          new ClipboardModule<Instrument>(),
          new FilterModule<Instrument>({ headerUi: true }),
        ],
      },
      width: 500,
      height: 236,
    }),
  play: async ({ canvasElement }) => {
    // In a filter box the user means the text they selected. Taking the key
    // here would replace it with the grid, silently.
    await gridReady(canvasElement);
    const input = getAllByRole(canvasElement, 'searchbox')[0]!;
    await userEvent.click(input);
    await userEvent.type(input, 'UKT');

    await expect(await pressKey('c', { ctrlKey: true })).toBe(false);
  },
};

export const TheKeyCanBeLeftUnbound: Story = {
  render: () => withClipboard({ copyOnKeyboard: false }),
  play: async ({ canvasElement }) => {
    // For an application that would rather drive copying from its own toolbar
    // than have the grid claim a key it wants.
    await gridReady(canvasElement);
    await userEvent.click(firstCell(canvasElement));

    await expect(await pressKey('c', { ctrlKey: true })).toBe(false);
  },
};

/**
 * Pasting, which is the half that writes.
 *
 * The placement — where a block lands, how far it spreads, what happens at the
 * edges — is arithmetic and is covered without a browser. What only a story can
 * see is that the key press arrives at all: that Ctrl-V reaches the module when
 * the grid has focus, and is left alone when the caret is in a box someone is
 * typing into.
 */

const pasteable = (options: ConstructorParameters<typeof ClipboardModule>[0] = {}) =>
  mountGrid({
    data,
    options: {
      layout: 'stack',
      columns: [
        { field: 'name', headerName: 'Instrument', width: 240, editable: true },
        { field: 'price', headerName: 'Price', width: 120, valueType: 'number', editable: true },
      ],
      modules: [
        new ClipboardModule<Instrument>({ pasteOnKeyboard: true, ...options }),
        new EditModule<Instrument>(),
        new RangeModule<Instrument>(),
      ],
    },
    width: 500,
    height: 236,
  });

export const CtrlVIsClaimedWhenPastingIsOn: Story = {
  render: () => pasteable(),
  play: async ({ canvasElement }) => {
    await gridReady(canvasElement);
    await userEvent.click(firstCell(canvasElement));

    await expect(await pressKey('v', { ctrlKey: true })).toBe(true);
  },
};

export const CtrlVIsNotClaimedByDefault: Story = {
  render: () => pasteable({ pasteOnKeyboard: false }),
  play: async ({ canvasElement }) => {
    // A paste writes, and copy does not. A grid that took whatever was on the
    // clipboard the first time someone pressed the wrong key would be a poor
    // default, so this is opt-in.
    await gridReady(canvasElement);
    await userEvent.click(firstCell(canvasElement));

    await expect(await pressKey('v', { ctrlKey: true })).toBe(false);
  },
};

export const PastingIntoAFilterInputIsLeftAlone: Story = {
  render: () =>
    mountGrid({
      data,
      options: {
        layout: 'stack',
        modules: [
          new ClipboardModule<Instrument>({ pasteOnKeyboard: true }),
          new EditModule<Instrument>(),
          new FilterModule<Instrument>({ headerUi: true }),
        ],
      },
      width: 500,
      height: 236,
    }),
  play: async ({ canvasElement }) => {
    // The reader means the box they are typing in, not the grid beneath it.
    await gridReady(canvasElement);
    const input = getAllByRole(canvasElement, 'searchbox')[0]!;
    await userEvent.click(input);

    await expect(await pressKey('v', { ctrlKey: true })).toBe(false);
  },
};

export const TextPastedThroughTheApiLandsInTheGrid: Story = {
  render: () => pasteable(),
  play: async ({ canvasElement }) => {
    // The system clipboard needs a permission the test browser will not grant,
    // so the text is handed over directly — which is also how an application
    // pasting from its own toolbar would do it. What this shows is the whole
    // path beyond the permission: parse, place, coerce and write.
    await gridReady(canvasElement);
    const grid = canvasElement.querySelector('ls-grid') as Grid<Instrument>;
    await userEvent.click(firstCell(canvasElement));

    grid.api.pasteText('UKT 9% 2050\t42');
    await gridReady(canvasElement);

    const cells = cellsOf(dataRows(canvasElement)[0]!);
    await expect(cellText(cells[0]!)).toBe('UKT 9% 2050');
    await expect(cellText(cells[1]!)).toBe((42).toLocaleString());
  },
};
