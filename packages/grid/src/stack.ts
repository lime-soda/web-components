import { defineElements } from './define-elements.js';
import { registerLayoutEngine } from './layout/engine-registry.js';
import { StackLayoutEngine } from './layout/stack-layout-engine.js';

/**
 * A grid with the conventional vertical layout alone.
 *
 * Registers the elements, and leaves the flow engine out. `layout: 'flow'`
 * throws here, naming the import that would provide it.
 */
defineElements();
registerLayoutEngine('stack', () => new StackLayoutEngine());

export * from './index.js';
