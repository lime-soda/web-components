import { defineElements } from './define-elements.js';
import { registerLayoutEngine } from './layout/engine-registry.js';
import { FlowLayoutEngine } from './layout/flow-layout-engine.js';

/**
 * A grid with the horizontal layout alone.
 *
 * Registers the elements, and leaves the stack engine, its chrome and the
 * sticky band out of the bundle. `layout: 'stack'` throws here, naming the
 * import that would provide it.
 */
defineElements();
registerLayoutEngine('flow', () => new FlowLayoutEngine());

export * from './index.js';
