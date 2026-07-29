import { FlowCell } from './components/cell.js';
import { FlowGrid } from './components/grid.js';
import { FlowHeaderCell } from './components/header-cell.js';
import { FlowInstance } from './components/instance.js';
import { FlowRow } from './components/row.js';

/** Tag name to class, for the elements a grid needs in order to render. */
export const ELEMENTS: Readonly<Record<string, CustomElementConstructor>> = {
  'flow-grid': FlowGrid,
  'flow-instance': FlowInstance,
  'flow-row': FlowRow,
  'flow-cell': FlowCell,
  'flow-header-cell': FlowHeaderCell,
};

/**
 * Registers an element unless the name is already taken.
 *
 * Two copies of the package on a page, or a consumer that registered a subclass
 * first, would otherwise throw and take the application down with them. The
 * first registration wins.
 */
export function defineElement(tagName: string, constructor: CustomElementConstructor): void {
  if (customElements.get(tagName) === undefined) customElements.define(tagName, constructor);
}

/**
 * Registers the grid's elements.
 *
 * Deliberately a call rather than an import side effect. Importing a class now
 * gives you the class and nothing else — no registration, and none of its
 * siblings dragged in behind it — so the classes can be subclassed, tested or
 * substituted through an import map without a grid appearing in the registry as
 * a consequence.
 *
 * Call this once, or import `@flow-grid/core/define`, which does it for you.
 *
 * Idempotent, so calling it repeatedly is harmless.
 */
export function defineElements(): void {
  for (const [tagName, constructor] of Object.entries(ELEMENTS)) {
    defineElement(tagName, constructor);
  }
}
