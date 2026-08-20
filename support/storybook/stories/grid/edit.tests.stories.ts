import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect, userEvent } from 'storybook/test';
import '@lime-soda/grid';
import '@lime-soda/grid/layouts';
import { EditModule, type EditModuleOptions } from '@lime-soda/grid/edit';
import {
  activeElement,
  cellText,
  cellsOf,
  dataRows,
  getByRole,
  gridReady,
  pressKey,
  queryAllByRole,
  tabInto,
  typeInto,
} from './shadow-queries.js';
import {
  COLUMN_WIDTHS,
  type Instrument,
  instruments,
  mountGrid,
  testStoryParameters,
} from './fixtures.js';

/**
 * Changing a value in place.
 *
 * Everything here is driven the way a person drives it: the grid is tabbed
 * into, keys are pressed on whatever has focus, and the editor is typed into as
 * a text box. Nothing calls the module — what a story can reach through the API
 * and not through the UI is covered by the unit tests instead, and repeating it
 * here would only prove the module can call itself.
 *
 * The Size column deliberately does not opt in. A grid where every column
 * accepts an edit cannot show that opting in is what does it.
 */

const editable = (options: EditModuleOptions = {}) =>
  mountGrid({
    data: instruments(5),
    width: 500,
    height: 236,
    options: {
      layout: 'stack',
      columns: [
        { field: 'name', headerName: 'Instrument', width: COLUMN_WIDTHS.name, editable: true },
        {
          field: 'price',
          headerName: 'Price',
          width: COLUMN_WIDTHS.price,
          valueType: 'number',
          editable: true,
        },
        { field: 'size', headerName: 'Size', width: COLUMN_WIDTHS.size },
      ],
      modules: [new EditModule<Instrument>(options)],
    },
  });

const meta: Meta = {
  title: 'Grid/Tests/Editing',
  parameters: testStoryParameters,
  render: () => editable(),
};

export default meta;
type Story = StoryObj;

/** The cell at a row and column, by position rather than by anything rendered. */
const cellAt = (canvas: HTMLElement, row: number, column: number) =>
  cellsOf(dataRows(canvas)[row]!)[column]!;

/** The open editor, as a text box — which is what it is to a reader. */
const editor = (canvas: HTMLElement) => getByRole(canvas, 'textbox') as HTMLInputElement;

const noEditor = (canvas: HTMLElement) => queryAllByRole(canvas, 'textbox').length === 0;

/** Types over the open editor, replacing what is in it. See `typeInto`. */
const replace = (canvas: HTMLElement, text: string) => typeInto(editor(canvas), text);

/** Puts the grid's focus on a cell the way a reader does: tab in, then arrow. */
const focusCell = async (canvas: HTMLElement, column: number) => {
  tabInto(canvas);
  for (let i = 0; i < column; i += 1) await pressKey('ArrowRight');
};

// --- opening ----------------------------------------------------------------

export const EnterOpensAnEditor: Story = {
  play: async ({ canvasElement }) => {
    await gridReady(canvasElement);
    await focusCell(canvasElement, 0);

    await pressKey('Enter');

    await expect(editor(canvasElement)).toBeTruthy();
    await expect(editor(canvasElement).value).toBe('INS 0');
  },
};

export const F2OpensAnEditor: Story = {
  play: async ({ canvasElement }) => {
    // The other convention, and the one a spreadsheet user reaches for.
    await gridReady(canvasElement);
    await focusCell(canvasElement, 0);

    await pressKey('F2');

    await expect(editor(canvasElement).value).toBe('INS 0');
  },
};

export const TypingOpensAnEditorAndReplacesTheValue: Story = {
  play: async ({ canvasElement }) => {
    // Typing over a cell means "this instead", not "append to what is here".
    await gridReady(canvasElement);
    await focusCell(canvasElement, 0);

    await pressKey('X');

    await expect(editor(canvasElement).value).toBe('X');
  },
};

export const DoubleClickingOpensAnEditor: Story = {
  play: async ({ canvasElement }) => {
    // The mouse needs a way in, and one click is how a cell is selected.
    await gridReady(canvasElement);

    await userEvent.dblClick(cellAt(canvasElement, 1, 0));

    await expect(editor(canvasElement).value).toBe('INS 1');
  },
};

export const AColumnThatDidNotOptInDoesNotOpen: Story = {
  play: async ({ canvasElement }) => {
    // Size is not editable, so Enter on it is not a write waiting to happen.
    await gridReady(canvasElement);
    await focusCell(canvasElement, 2);

    await pressKey('Enter');

    await expect(noEditor(canvasElement)).toBe(true);
  },
};

export const TheEditorTakesTheCaret: Story = {
  play: async ({ canvasElement }) => {
    // Opening an editor the reader then has to click into is not an editor.
    await gridReady(canvasElement);
    await focusCell(canvasElement, 0);

    await pressKey('Enter');

    await expect(activeElement()).toBe(editor(canvasElement));
  },
};

// --- finishing --------------------------------------------------------------

export const EnterCommitsAndStepsDown: Story = {
  play: async ({ canvasElement }) => {
    // A column gets filled in without reaching for the mouse.
    await gridReady(canvasElement);
    await focusCell(canvasElement, 0);
    await pressKey('Enter');

    await replace(canvasElement, 'UKT 2030');
    await pressKey('Enter');

    await expect(cellText(cellAt(canvasElement, 0, 0))).toBe('UKT 2030');
    await expect(activeElement()).toBe(cellAt(canvasElement, 1, 0));
  },
};

export const EscapeDiscardsWhatWasTyped: Story = {
  play: async ({ canvasElement }) => {
    await gridReady(canvasElement);
    await focusCell(canvasElement, 0);
    await pressKey('Enter');

    await replace(canvasElement, 'nonsense');
    await pressKey('Escape');

    await expect(cellText(cellAt(canvasElement, 0, 0))).toBe('INS 0');
    await expect(noEditor(canvasElement)).toBe(true);
  },
};

export const EscapeLeavesFocusOnTheCell: Story = {
  play: async ({ canvasElement }) => {
    // Abandoning an edit should not also abandon the reader's place.
    await gridReady(canvasElement);
    await focusCell(canvasElement, 0);
    await pressKey('Enter');

    await pressKey('Escape');

    await expect(activeElement()).toBe(cellAt(canvasElement, 0, 0));
  },
};

export const TabCommitsAndStepsAcross: Story = {
  play: async ({ canvasElement }) => {
    await gridReady(canvasElement);
    await focusCell(canvasElement, 0);
    await pressKey('Enter');

    await replace(canvasElement, 'UKT 2041');
    await pressKey('Tab');

    await expect(cellText(cellAt(canvasElement, 0, 0))).toBe('UKT 2041');
    await expect(activeElement()).toBe(cellAt(canvasElement, 0, 1));
  },
};

export const ClickingAwayCommits: Story = {
  play: async ({ canvasElement }) => {
    // The contested one, and the reason it is contested: losing a typed value
    // by clicking off to look at something is what people report as a bug.
    await gridReady(canvasElement);
    await userEvent.dblClick(cellAt(canvasElement, 0, 0));

    await replace(canvasElement, 'UKT 2035');
    await userEvent.click(cellAt(canvasElement, 3, 2));

    await expect(cellText(cellAt(canvasElement, 0, 0))).toBe('UKT 2035');
    await expect(noEditor(canvasElement)).toBe(true);
  },
};

export const OpeningAnotherEditorCommitsTheFirst: Story = {
  play: async ({ canvasElement }) => {
    // Two open editors is not a state to resolve: which one won would depend on
    // the order the clicks arrived in.
    await gridReady(canvasElement);
    await userEvent.dblClick(cellAt(canvasElement, 0, 0));
    await replace(canvasElement, 'UKT 2050');

    await userEvent.dblClick(cellAt(canvasElement, 2, 0));

    await expect(cellText(cellAt(canvasElement, 0, 0))).toBe('UKT 2050');
    await expect(queryAllByRole(canvasElement, 'textbox')).toHaveLength(1);
  },
};

// --- the value type's editor ------------------------------------------------

export const ANumberColumnEditsItsNumberNotItsFormatting: Story = {
  play: async ({ canvasElement }) => {
    // The cell reads 100 with its separators; the edit starts from the value,
    // because parsing a formatter's output back is not something a formatter
    // promises is possible.
    await gridReady(canvasElement);
    await focusCell(canvasElement, 1);

    await pressKey('Enter');

    await expect(editor(canvasElement).value).toBe('100');
  },
};

export const ANumberColumnStoresANumberAndFormatsIt: Story = {
  play: async ({ canvasElement }) => {
    await gridReady(canvasElement);
    await focusCell(canvasElement, 1);
    await pressKey('Enter');

    await replace(canvasElement, '2500');
    await pressKey('Enter');

    // Formatted on the way back out, which only happens for a number.
    await expect(cellText(cellAt(canvasElement, 0, 1))).toBe((2500).toLocaleString());
  },
};

export const ANumberColumnKeepsTheLastGoodValue: Story = {
  play: async ({ canvasElement }) => {
    // Typing nonsense into a number is a rejected keystroke, not an erased
    // value — which is what `type="number"` would have made it.
    await gridReady(canvasElement);
    await focusCell(canvasElement, 1);
    await pressKey('Enter');

    await replace(canvasElement, 'abc');
    await pressKey('Enter');

    await expect(cellText(cellAt(canvasElement, 0, 1))).toBe((100).toLocaleString());
  },
};

// --- turning the affordances off --------------------------------------------

export const TypingCanBeLeftUnbound: Story = {
  render: () => editable({ editOnTyping: false }),
  play: async ({ canvasElement }) => {
    // For a grid that wants the letter keys for its own shortcuts.
    await gridReady(canvasElement);
    await focusCell(canvasElement, 0);

    await pressKey('X');

    await expect(noEditor(canvasElement)).toBe(true);
  },
};

export const DoubleClickCanBeLeftUnbound: Story = {
  render: () => editable({ editOnDoubleClick: false }),
  play: async ({ canvasElement }) => {
    await gridReady(canvasElement);

    await userEvent.dblClick(cellAt(canvasElement, 0, 0));

    await expect(noEditor(canvasElement)).toBe(true);
  },
};
