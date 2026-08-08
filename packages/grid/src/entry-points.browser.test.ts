import { describe, expect, it } from 'vite-plus/test';
import { createLayoutEngine } from './layout/engine-registry.js';
import './flow.js';

/**
 * What each entry point provides.
 *
 * The root entry has no side effects: it hands out classes and types, and a
 * grid comes from an entry that provides one. This file imports the flow entry
 * alone, so the stack layout should be absent — and say so rather than failing
 * obscurely.
 */

describe('the flow entry point', () => {
  it('registers the elements', () => {
    expect(customElements.get('ls-grid')).toBeDefined();
    expect(customElements.get('ls-grid-cell')).toBeDefined();
  });

  it('provides the flow layout', () => {
    expect(createLayoutEngine('flow')).toBeDefined();
  });

  it('refuses the stack layout, naming the import that would provide it', () => {
    expect(() => createLayoutEngine('stack')).toThrow(/@lime-soda\/grid\/stack/);
  });
});
