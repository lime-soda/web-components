export type TextFilterOperator =
  | 'contains'
  | 'notContains'
  | 'equals'
  | 'notEqual'
  | 'startsWith'
  | 'endsWith'
  | 'blank'
  | 'notBlank';

export type NumberFilterOperator =
  | 'equals'
  | 'notEqual'
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'lessThan'
  | 'lessThanOrEqual'
  | 'inRange'
  | 'blank'
  | 'notBlank';

export interface TextFilter {
  readonly type: 'text';
  readonly operator: TextFilterOperator;
  readonly value?: string;
  readonly caseSensitive?: boolean;
}

export interface NumberFilter {
  readonly type: 'number';
  readonly operator: NumberFilterOperator;
  readonly value?: number;
  /** Upper bound for `inRange`, inclusive. */
  readonly to?: number;
}

export interface SetFilter {
  readonly type: 'set';
  /** Values to keep. An empty list matches nothing. */
  readonly values: readonly unknown[];
}

export type ColumnFilter = TextFilter | NumberFilter | SetFilter;

/** Column filters keyed by colId. */
export type FilterModel = Readonly<Record<string, ColumnFilter>>;

const isBlank = (value: unknown): boolean => value === null || value === undefined || value === '';

/** Whether a single value passes one column filter. */
export function matchesFilter(value: unknown, filter: ColumnFilter): boolean {
  switch (filter.type) {
    case 'text':
      return matchesText(value, filter);
    case 'number':
      return matchesNumber(value, filter);
    case 'set':
      return filter.values.includes(value);
  }
}

/**
 * A value's text, for a filter that compares text.
 *
 * Anything without one reads as blank rather than as its default
 * stringification: a cell holding an object would otherwise contain the literal
 * "[object Object]", and a search for "object" would match every one of them.
 */
function asText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  return '';
}

function matchesText(value: unknown, filter: TextFilter): boolean {
  if (filter.operator === 'blank') return isBlank(value);
  if (filter.operator === 'notBlank') return !isBlank(value);

  // An operator needing a term but given none is treated as inactive rather than
  // matching nothing — a half-typed filter should not blank the grid.
  if (filter.value === undefined || filter.value === '') return true;

  const text = asText(value);
  const haystack = filter.caseSensitive ? text : text.toLowerCase();
  const needle = filter.caseSensitive ? filter.value : filter.value.toLowerCase();

  switch (filter.operator) {
    case 'contains':
      return haystack.includes(needle);
    case 'notContains':
      return !haystack.includes(needle);
    case 'equals':
      return haystack === needle;
    case 'notEqual':
      return haystack !== needle;
    case 'startsWith':
      return haystack.startsWith(needle);
    case 'endsWith':
      return haystack.endsWith(needle);
    default:
      return true;
  }
}

function matchesNumber(value: unknown, filter: NumberFilter): boolean {
  if (filter.operator === 'blank') return isBlank(value);
  if (filter.operator === 'notBlank') return !isBlank(value);
  if (filter.value === undefined) return true;

  const numeric = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(numeric)) return false;

  switch (filter.operator) {
    case 'equals':
      return numeric === filter.value;
    case 'notEqual':
      return numeric !== filter.value;
    case 'greaterThan':
      return numeric > filter.value;
    case 'greaterThanOrEqual':
      return numeric >= filter.value;
    case 'lessThan':
      return numeric < filter.value;
    case 'lessThanOrEqual':
      return numeric <= filter.value;
    case 'inRange':
      return numeric >= filter.value && numeric <= (filter.to ?? Number.POSITIVE_INFINITY);
    default:
      return true;
  }
}

/** Data fields a model reads, or '*' when a filtered column derives its value. */
export function filterDependencies(
  model: FilterModel,
  fieldFor: (colId: string) => { field?: string | undefined; derived: boolean } | undefined,
): ReadonlySet<string> | '*' | undefined {
  const colIds = Object.keys(model);
  if (colIds.length === 0) return undefined;

  const fields = new Set<string>();
  for (const colId of colIds) {
    const column = fieldFor(colId);
    if (!column) continue;
    if (column.derived) return '*';
    if (column.field) fields.add(column.field);
  }
  return fields;
}
