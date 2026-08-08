import { defineElements } from './define-elements.js';
import { registerLayoutEngine } from './layout/engine-registry.js';
import { FlowLayoutEngine } from './layout/flow-layout-engine.js';
import { StackLayoutEngine } from './layout/stack-layout-engine.js';

/**
 * A grid with every layout, switchable through `layout: 'flow' | 'stack'`.
 *
 * The plural sibling of `ls-grid/flow` and `ls-grid/stack`: same job, both
 * engines. Registers the elements too, so one import is enough to render.
 *
 * Importing `ls-grid/flow` and `ls-grid/stack` together does the same
 * thing — each registers its own engine, and registering an element twice is a
 * no-op. This exists because asking for both is common enough to deserve a
 * name.
 */
defineElements();
registerLayoutEngine('flow', () => new FlowLayoutEngine());
registerLayoutEngine('stack', () => new StackLayoutEngine());

export * from './index.js';
