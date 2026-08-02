import { defineElements } from './define-elements.js';

/**
 * Side-effect entry: registers the grid's elements on import.
 *
 * `import 'flow-grid/define'` for consumers who want the elements
 * available and nothing to think about. Everything else in the package is
 * side-effect free, so importing the classes alone registers nothing.
 */
defineElements();
