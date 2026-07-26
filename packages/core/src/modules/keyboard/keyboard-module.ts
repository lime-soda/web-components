import type { GridModule, ModuleContext } from '../types.js';

export interface KeyboardModuleOptions {
  /** Ctrl/Cmd + Left/Right jumps a whole instance. On by default. */
  instanceJump?: boolean;
}

/**
 * Keyboard navigation.
 *
 * Deliberately thin: it maps keys onto the focus controller and does nothing
 * else. Traversal is layout mechanics and lives in core, so replacing these
 * bindings — a desk that wants vim keys, say — means writing a module of about
 * this size rather than reimplementing how instances and rows are arranged.
 *
 * Rewritten from the prototype's 471-line GridKeyboardBase, which mixed key
 * handling, focus tracking, DOM queries and sort/filter invocation together in a
 * component base class.
 */
export class KeyboardModule<TData = unknown> implements GridModule<TData> {
  readonly id = 'keyboard';

  private context?: ModuleContext<TData>;

  constructor(private readonly options: KeyboardModuleOptions = {}) {}

  init(context: ModuleContext<TData>): void {
    this.context = context;
  }

  onKeyDown(event: KeyboardEvent): boolean {
    const focus = this.context?.focus;
    if (!focus) return false;

    // Nothing focused yet: the first navigation key enters the grid at its start.
    if (focus.focused.get() === null && NAVIGATION_KEYS.has(event.key)) {
      focus.focusFirst();
      return true;
    }

    const jump = (this.options.instanceJump ?? true) && (event.ctrlKey || event.metaKey);

    switch (event.key) {
      case 'ArrowDown':
        return focus.moveRow(1);
      case 'ArrowUp':
        return focus.moveRow(-1);
      case 'ArrowRight':
        return jump ? focus.moveInstance(1) : focus.moveColumn(1);
      case 'ArrowLeft':
        return jump ? focus.moveInstance(-1) : focus.moveColumn(-1);
      case 'Home':
        return focus.moveToEdge(jump ? 'instanceStart' : 'rowStart');
      case 'End':
        return focus.moveToEdge(jump ? 'instanceEnd' : 'rowEnd');
      // A page is an instance: an instance is exactly one viewport of rows, so
      // paging and jumping instances are the same movement here.
      case 'PageDown':
        return focus.moveInstance(1);
      case 'PageUp':
        return focus.moveInstance(-1);
      case 'Escape':
        focus.clear();
        return true;
      default:
        return false;
    }
  }
}

const NAVIGATION_KEYS = new Set([
  'ArrowDown',
  'ArrowUp',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'PageDown',
  'PageUp',
]);
