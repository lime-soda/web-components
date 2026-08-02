import { defineElements } from './define-elements.js';
import { registerLayoutEngine } from './layout/engine-registry.js';
import { FlowLayoutEngine } from './layout/flow-layout-engine.js';
import { StackLayoutEngine } from './layout/stack-layout-engine.js';

/**
 * A grid with both layouts, switchable through `layout: 'flow' | 'stack'`.
 *
 * Registers the elements too, so this one import is enough to render. Reach for
 * `flow-grid/flow` or `flow-grid/stack` instead when the choice is made at
 * build time and the other layout is dead weight.
 */
defineElements();
registerLayoutEngine('flow', () => new FlowLayoutEngine());
registerLayoutEngine('stack', () => new StackLayoutEngine());

export * from './index.js';
