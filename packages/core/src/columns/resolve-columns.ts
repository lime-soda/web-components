import type { RowNode } from '../store/types.js';
import type {
  ColumnDef,
  ColumnDefs,
  ColumnResolutionOptions,
  ResolvedColumn,
  ValueFormatterParams,
} from './types.js';

const DEFAULT_WIDTH = 100;

/**
 * Merges each column definition over its column types and the grid defaults, then
 * fills in the values every renderer needs: a stable id, a header name and a
 * concrete width.
 *
 * Precedence, weakest first: `defaultColDef` → each entry of `type` in order →
 * the column's own definition.
 */
export function resolveColumns<TData = unknown>(
  defs: ColumnDefs<TData>,
  options: ColumnResolutionOptions<TData> = {},
): readonly ResolvedColumn<TData>[] {
  const seen = new Set<string>();

  return defs.map((def, index) => {
    const merged = mergeDefinition(def, options);
    const colId = uniqueId(baseId(merged, index), seen);

    // A declared width pins the column. Otherwise it flexes — including when
    // nothing at all was declared, so a grid of bare columns fills its container
    // rather than leaving a gap beside the last one.
    const sizing: 'fixed' | 'flex' = merged.width !== undefined ? 'fixed' : 'flex';
    const flex = sizing === 'flex' ? (merged.flex ?? 1) : 0;
    const width = Math.max(merged.width ?? DEFAULT_WIDTH, merged.minWidth ?? 0);

    return {
      ...merged,
      colId,
      index,
      width,
      sizing,
      flex,
      headerName: merged.headerName ?? humanise(lastSegment(merged.field)),
    } as ResolvedColumn<TData>;
  });
}

/**
 * The value a cell is about, before formatting. Sort comparators and cell-flash
 * diffing use this, so a computed column sorts and flashes on what it displays
 * rather than on the raw field behind it.
 */
export function getCellValue<TData, TValue = unknown>(
  column: ResolvedColumn<TData, TValue>,
  node: RowNode<TData>,
): TValue | undefined {
  if (column.valueGetter) {
    return column.valueGetter({ data: node.data, node, column });
  }
  if (column.field === undefined) return undefined;
  return readPath(node.data, column.field) as TValue | undefined;
}

/** The display string for a cell: `valueGetter` → `valueFormatter` → `String`. */
export function formatCellValue<TData, TValue = unknown>(
  column: ResolvedColumn<TData, TValue>,
  node: RowNode<TData>,
): string {
  const value = getCellValue(column, node);

  if (column.valueFormatter) {
    return column.valueFormatter({ value, data: node.data, node, column });
  }

  // Empty rather than "null"/"undefined": a missing quote should read as blank.
  return value === null || value === undefined ? '' : String(value);
}

function mergeDefinition<TData>(
  def: ColumnDef<TData>,
  options: ColumnResolutionOptions<TData>,
): ColumnDef<TData> {
  const typeNames = def.type === undefined ? [] : Array.isArray(def.type) ? def.type : [def.type];
  const types = typeNames
    .map((name) => options.columnTypes?.[name as string])
    .filter((type): type is ColumnDef<TData> => type !== undefined);

  return Object.assign({}, options.defaultColDef, ...types, def) as ColumnDef<TData>;
}

function baseId<TData>(def: ColumnDef<TData>, index: number): string {
  return def.colId ?? def.field ?? `col-${index}`;
}

function uniqueId(candidate: string, seen: Set<string>): string {
  let id = candidate;
  let suffix = 1;
  while (seen.has(id)) {
    id = `${candidate}-${suffix}`;
    suffix += 1;
  }
  seen.add(id);
  return id;
}

function lastSegment(field: string | undefined): string {
  if (field === undefined) return '';
  const segments = field.split('.');
  return segments[segments.length - 1] ?? '';
}

/** `bidPrice` → `Bid Price`. */
function humanise(field: string): string {
  if (field === '') return '';
  return field
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, (c) => c.toUpperCase());
}

function readPath(source: unknown, path: string): unknown {
  if (!path.includes('.')) {
    return isRecord(source) ? source[path] : undefined;
  }

  let current: unknown = source;
  for (const segment of path.split('.')) {
    if (!isRecord(current)) return undefined;
    current = current[segment];
  }
  return current;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
