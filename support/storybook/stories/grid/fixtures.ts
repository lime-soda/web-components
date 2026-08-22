import { html } from 'lit';
import type { TemplateResult } from 'lit';
import type { ColumnDef, GridOptions } from '@lime-soda/grid';

/**
 * One shape of row, and one way to mount a grid, for every test story.
 *
 * The files here had grown five near-identical row types — Quote, Row, Bond,
 * each with its own generator and its own column widths — which made two
 * stories testing the same thing hard to compare and a change to the fixture a
 * change in five places. Worse, the numbers a story depends on (how many rows
 * fit an instance, how wide a column is) were restated per file and drifted.
 *
 * Everything below is deliberately boring. A test that needs something unusual
 * says so at the point of use rather than inventing a parallel world.
 */

export interface Instrument {
  id: string;
  /** Null for a group heading; a group's id for an instrument beneath it. */
  parentId: string | null;
  name: string;
  price: number;
  size: number;
}

/** A flat list, which is what most stories want. */
export const instruments = (count: number): Instrument[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `i${i}`,
    parentId: null,
    name: `INS ${i}`,
    price: 100 + i,
    size: 1000 + i * 10,
  }));

/** Groups with instruments beneath them, for anything involving a hierarchy. */
export const grouped = (groups: number, perGroup: number): Instrument[] =>
  Array.from({ length: groups }, (_, g) => [
    { id: `g${g}`, parentId: null, name: `Group ${g}`, price: 0, size: 0 },
    ...Array.from({ length: perGroup }, (_, i) => ({
      id: `g${g}-${i}`,
      parentId: `g${g}`,
      name: `INS ${g}.${i}`,
      price: 100 + i,
      size: 1000 + i * 10,
    })),
  ]).flat();

/**
 * The standard columns.
 *
 * Widths are round and stated once, because stories reason about them: three
 * columns come to 480px, so a 500px frame scrolls and a 700px one does not.
 */
export const COLUMN_WIDTHS = { name: 240, price: 120, size: 120 } as const;

export const columns: ColumnDef<Instrument>[] = [
  { field: 'name', headerName: 'Instrument', width: COLUMN_WIDTHS.name },
  { field: 'price', headerName: 'Price', width: COLUMN_WIDTHS.price },
  { field: 'size', headerName: 'Size', width: COLUMN_WIDTHS.size },
];

/**
 * Row and header heights, stated once for the same reason.
 *
 * At these sizes an instance of height H holds `floor((H - 40) / 32)` rows, so
 * a 360px frame holds ten and a story wanting four instances needs forty rows.
 */
export const ROW_HEIGHT = 32;
export const HEADER_HEIGHT = 40;

/** How many rows fit one instance at a given frame height. */
export const rowsPerInstance = (height: number): number =>
  Math.floor((height - HEADER_HEIGHT) / ROW_HEIGHT);

export interface MountOptions {
  data: Instrument[];
  options?: Partial<GridOptions<Instrument>>;
  width?: number;
  height?: number;
  /** Rendered after the grid, for stories about focus leaving it. */
  after?: TemplateResult;
}

/**
 * A grid in a frame of a known size.
 *
 * Sized to its content rather than the viewport: a snapshot that is mostly
 * empty canvas hides the change it exists to show, and a story that measures
 * instances needs the frame to be the number it reasoned about.
 */
export const mountGrid = ({
  data,
  options = {},
  width = 700,
  height = 360,
  after,
}: MountOptions): TemplateResult => {
  const merged: GridOptions<Instrument> = {
    columns,
    getRowId: (row) => row.id,
    layout: 'flow',
    rowHeight: ROW_HEIGHT,
    headerHeight: HEADER_HEIGHT,
    modules: [],
    ...options,
  };

  return html`
    <div id="frame" style=${`width:${width}px;height:${height}px`}>
      <ls-grid .gridOptions=${merged} .rowData=${data} style="height:100%"></ls-grid>
    </div>
    ${after ?? null}
  `;
};

/**
 * Shared with every test story, whichever component it is for.
 *
 * Re-exported here because this file is the one import a grid test story needs,
 * and the definitions live next door so the button's stories can hold to the
 * same rules rather than to a copy of them that drifts.
 */
export { testStoryParameters, visualStoryParameters } from '../story-parameters.js';
