import type { LayoutMode } from '../controller/grid-controller.js';
import type { LayoutEngine } from './types.js';

/**
 * The layout engines available to a grid.
 *
 * The controller used to name both and pick with a ternary, which meant a
 * flow-only grid still shipped the stack engine, its chrome and the sticky
 * band — unreachable code in the one place the package's own "pay for what you
 * import" rule was broken.
 *
 * An entry point registers what it provides, so what a bundle contains follows
 * from what it imported, exactly as it does for modules.
 */
const engines = new Map<LayoutMode, () => LayoutEngine>();

export function registerLayoutEngine(mode: LayoutMode, create: () => LayoutEngine): void {
  engines.set(mode, create);
}

export function createLayoutEngine(mode: LayoutMode): LayoutEngine {
  const create = engines.get(mode);
  if (!create) {
    throw new Error(
      `Layout "${mode}" is not available. Import 'flow-grid' for both layouts, ` +
        `or 'flow-grid/${mode}' for this one alone.`,
    );
  }
  return create();
}
