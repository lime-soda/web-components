import type { RowStore } from '../../store/row-store.js';

export interface TreeIndexOptions<TData> {
  /** Self-referential form: the id of a row's parent, or null/undefined at root. */
  getParentId?: (data: TData) => string | null | undefined;
  /** Path form: ancestor ids from root down to (but excluding) the row itself. */
  getHierarchy?: (data: TData) => readonly string[] | undefined;
}

/**
 * Parent and child lookups over the row store.
 *
 * Rebuilt only on structural change and only for the rows involved, rather than
 * reconstructing the whole tree on every notification the way the prototype's
 * `buildTreeFromMap` did — at tick rates that walk dominated the frame.
 */
export class TreeIndex<TData = unknown> {
  private readonly parents = new Map<string, string | null>();
  private readonly children = new Map<string | null, string[]>();
  private readonly getParent: (data: TData) => string | null;
  private builtVersion = -1;

  constructor(
    private readonly store: RowStore<TData>,
    options: TreeIndexOptions<TData>,
  ) {
    this.getParent = normaliseParentAccessor(options);
    this.rebuild();
  }

  /**
   * Rebuilds if the store has changed shape since the last build.
   *
   * Called at projection time rather than from a store subscription, because a
   * grid registers its modules before any data arrives: the module is initialised
   * in the controller's constructor, and `rowData` is set afterwards. Deriving
   * freshness from the store's own version removes that ordering hazard entirely.
   *
   * @returns whether a rebuild actually happened.
   */
  ensureFresh(): boolean {
    if (this.store.structuralVersion.get() === this.builtVersion) return false;
    this.rebuild();
    return true;
  }

  /** Rebuilds from the store. Cheap relative to a render, and only on structural change. */
  rebuild(): void {
    this.builtVersion = this.store.structuralVersion.get();
    this.parents.clear();
    this.children.clear();

    for (const node of this.store.rows.get()) {
      const parentId = this.getParent(node.data);
      this.parents.set(node.id, parentId);
    }

    // Second pass so a child declared before its parent still lands correctly.
    for (const node of this.store.rows.get()) {
      const declared = this.parents.get(node.id) ?? null;
      // A parent that is not in the store leaves the row at the root rather than
      // orphaning it out of the grid entirely.
      const parentId = declared !== null && this.parents.has(declared) ? declared : null;
      this.parents.set(node.id, parentId);
      const siblings = this.children.get(parentId);
      if (siblings) siblings.push(node.id);
      else this.children.set(parentId, [node.id]);
    }
  }

  parentOf(id: string): string | null {
    return this.parents.get(id) ?? null;
  }

  childIdsOf(id: string | null): readonly string[] {
    return this.children.get(id) ?? [];
  }

  hasChildren(id: string): boolean {
    return this.childIdsOf(id).length > 0;
  }

  rootIds(): readonly string[] {
    return this.childIdsOf(null);
  }

  /** Ancestor ids from root down to the row's parent. */
  ancestorsOf(id: string): readonly string[] {
    const chain: string[] = [];
    const guard = new Set<string>([id]);

    let current = this.parentOf(id);
    while (current !== null && !guard.has(current)) {
      chain.push(current);
      guard.add(current);
      current = this.parentOf(current);
    }

    return chain.reverse();
  }

  depthOf(id: string): number {
    return this.ancestorsOf(id).length;
  }

  /** Every descendant of a row, depth-first. */
  descendantsOf(id: string): readonly string[] {
    const out: string[] = [];
    const walk = (current: string): void => {
      for (const child of this.childIdsOf(current)) {
        out.push(child);
        walk(child);
      }
    };
    walk(id);
    return out;
  }

  allIds(): readonly string[] {
    return [...this.parents.keys()];
  }
}

function normaliseParentAccessor<TData>(
  options: TreeIndexOptions<TData>,
): (data: TData) => string | null {
  if (options.getParentId) {
    const get = options.getParentId;
    return (data) => get(data) ?? null;
  }

  if (options.getHierarchy) {
    const get = options.getHierarchy;
    return (data) => {
      const path = get(data);
      return path && path.length > 0 ? (path[path.length - 1] ?? null) : null;
    };
  }

  throw new Error('The tree module needs either a getParentId or a getHierarchy option.');
}
