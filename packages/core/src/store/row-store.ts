import {
  type ReadableSignal,
  type WritableSignal,
  computed,
  signal,
  Version,
} from '../reactive/index.js';
import type { RowNode, RowTransaction, TransactionResult } from './types.js';

export interface RowStoreOptions<TData> {
  getRowId: (data: TData) => string;
}

type Listener<TData> = (result: TransactionResult, store: RowStore<TData>) => void;

const EMPTY_FIELDS: ReadonlySet<string> = new Set();

/**
 * Holds every row client-side and applies changes transactionally.
 *
 * The store's job is to make one distinction cheap and explicit: *structural*
 * change (rows added, removed or reordered) versus *value* change (a price
 * ticked). Only the first invalidates {@link structuralVersion}, and therefore
 * only the first causes the projection and layout computeds downstream to re-run.
 * A tick writes a row signal, the bound cells re-render, and nothing else moves.
 */
export class RowStore<TData = unknown> {
  private readonly nodes = new Map<string, RowNode<TData>>();
  private readonly signals = new Map<string, WritableSignal<RowNode<TData> | undefined>>();
  private readonly listeners = new Set<Listener<TData>>();
  private readonly getRowId: (data: TData) => string;

  /** Invalidated only by structural change. Read by the projection pipeline. */
  readonly structuralVersion = new Version();

  /**
   * Rows in insertion order. Rebuilt only when {@link structuralVersion} changes,
   * so its identity is stable across value updates.
   */
  readonly rows: ReadableSignal<readonly RowNode<TData>[]>;

  private pending: {
    added: string[];
    updated: string[];
    removed: string[];
    fieldsChanged: Set<string>;
  } | null = null;

  constructor(options: RowStoreOptions<TData>) {
    this.getRowId = options.getRowId;
    this.rows = computed(() => {
      this.structuralVersion.get();
      return [...this.nodes.values()];
    });
  }

  getRow(id: string): TData | undefined {
    return this.nodes.get(id)?.data;
  }

  getRowNode(id: string): RowNode<TData> | undefined {
    return this.nodes.get(id);
  }

  has(id: string): boolean {
    return this.nodes.has(id);
  }

  get size(): number {
    return this.nodes.size;
  }

  /**
   * The signal backing one row. Created on demand so a renderer can bind to a row
   * that has not arrived yet, and shared by id so every copy of a repeated
   * ancestor row reads the same source.
   */
  rowSignal(id: string): ReadableSignal<RowNode<TData> | undefined> {
    return this.writableRowSignal(id);
  }

  private writableRowSignal(id: string): WritableSignal<RowNode<TData> | undefined> {
    let existing = this.signals.get(id);
    if (!existing) {
      existing = signal<RowNode<TData> | undefined>(this.nodes.get(id));
      this.signals.set(id, existing);
    }
    return existing;
  }

  applyTransaction(transaction: RowTransaction<TData>): TransactionResult {
    const added: string[] = [];
    const updated: string[] = [];
    const removed: string[] = [];
    const fieldsChanged = new Set<string>();

    for (const id of transaction.remove ?? []) {
      if (!this.nodes.delete(id)) continue;
      removed.push(id);
      this.signals.get(id)?.set(undefined);
    }

    for (const data of transaction.add ?? []) {
      const id = this.getRowId(data);
      const node: RowNode<TData> = { id, data };
      const replaced = this.nodes.has(id);
      this.nodes.set(id, node);
      this.writableRowSignal(id).set(node);
      if (replaced) updated.push(id);
      else added.push(id);
    }

    for (const data of transaction.update ?? []) {
      const id = this.getRowId(data);
      const existing = this.nodes.get(id);
      // Unknown ids are ignored rather than upserted: a stale tick for a row that
      // has been removed must not resurrect it.
      if (!existing) continue;

      for (const field of changedFields(existing.data, data)) fieldsChanged.add(field);

      const node: RowNode<TData> = { id, data };
      this.nodes.set(id, node);
      this.writableRowSignal(id).set(node);
      updated.push(id);
    }

    const structural = added.length > 0 || removed.length > 0;
    if (structural) this.structuralVersion.bump();

    const result: TransactionResult & { fieldsChanged: ReadonlySet<string> } = {
      added,
      updated,
      removed,
      structural,
      fieldsChanged: fieldsChanged.size > 0 ? fieldsChanged : EMPTY_FIELDS,
    };

    this.enqueue(result);
    return result;
  }

  /** Replaces the entire row set, reporting the difference against what was there. */
  setRowData(data: readonly TData[]): TransactionResult {
    const previous = new Map(this.nodes);
    const nextIds = new Set(data.map((d) => this.getRowId(d)));

    const added: string[] = [];
    const updated: string[] = [];
    const removed: string[] = [];
    const fieldsChanged = new Set<string>();

    for (const id of previous.keys()) {
      if (nextIds.has(id)) continue;
      removed.push(id);
      this.signals.get(id)?.set(undefined);
    }

    // Rebuilt rather than patched so insertion order matches `data` exactly.
    this.nodes.clear();

    for (const item of data) {
      const id = this.getRowId(item);
      const node: RowNode<TData> = { id, data: item };
      this.nodes.set(id, node);
      this.writableRowSignal(id).set(node);

      const before = previous.get(id);
      if (before) {
        updated.push(id);
        for (const field of changedFields(before.data, item)) fieldsChanged.add(field);
      } else {
        added.push(id);
      }
    }

    // A wholesale replace can reorder rows even when membership is unchanged, so
    // it always counts as structural.
    this.structuralVersion.bump();

    const result: TransactionResult = {
      added,
      updated,
      removed,
      structural: true,
      fieldsChanged: fieldsChanged.size > 0 ? fieldsChanged : EMPTY_FIELDS,
    };

    this.enqueue(result);
    return result;
  }

  subscribe(listener: Listener<TData>): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Delivers any pending notification now. Mainly an escape hatch for tests. */
  flushSync(): void {
    this.deliver();
  }

  private enqueue(result: TransactionResult & { fieldsChanged: ReadonlySet<string> }): void {
    if (this.listeners.size === 0) return;

    if (this.pending === null) {
      this.pending = { added: [], updated: [], removed: [], fieldsChanged: new Set() };
      queueMicrotask(() => this.deliver());
    }

    this.pending.added.push(...result.added);
    this.pending.updated.push(...result.updated);
    this.pending.removed.push(...result.removed);
    for (const field of result.fieldsChanged) this.pending.fieldsChanged.add(field);
  }

  private deliver(): void {
    const pending = this.pending;
    if (pending === null) return;
    this.pending = null;

    const result: TransactionResult = {
      added: pending.added,
      updated: pending.updated,
      removed: pending.removed,
      structural: pending.added.length > 0 || pending.removed.length > 0,
      fieldsChanged: pending.fieldsChanged,
    };

    for (const listener of [...this.listeners]) listener(result, this);
  }
}

/**
 * Shallow key diff between two data objects. Sort and filter stages use the result
 * to decide whether a tick touched anything they care about — a price change
 * re-runs the sort only when price is an active sort key.
 */
function changedFields(before: unknown, after: unknown): readonly string[] {
  if (before === after) return [];
  if (!isRecord(before) || !isRecord(after)) return ['*'];

  const changed: string[] = [];
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (!Object.is(before[key], after[key])) changed.push(key);
  }
  return changed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
