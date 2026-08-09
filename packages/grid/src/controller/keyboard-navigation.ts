import type { FocusController } from './focus-controller.js';

/**
 * The keyboard floor, which is core because the role is.
 *
 * The grid announces `role="grid"` (or `treegrid`), and the ARIA pattern for
 * those roles *requires* arrow-key navigation: a screen reader tells the user
 * this is a grid and that arrows move around it. Leaving that to an optional
 * module meant the default grid made a promise it did not keep — not a missing
 * convenience but an incorrect announcement.
 *
 * Tab is here for a stronger reason still. It moves in reading order and is
 * deliberately allowed to run out: at either end this returns false, the key
 * goes unhandled, and the browser moves focus to whatever follows the grid. A
 * grid you cannot Tab out of is a keyboard trap, which fails WCAG 2.1.2
 * regardless of any role.
 *
 * What is *not* here is everything the pattern lists as optional — Home, End,
 * the page keys, jumping between instances, and skipping rows by a predicate.
 * Those stay in the keyboard module, which is offered every key first, so
 * installing it replaces this with its richer handling rather than fighting it.
 */
export function handleNavigationKey(event: KeyboardEvent, focus: FocusController): boolean {
  // Nothing focused yet: the first arrow enters the grid at its start, so a
  // keyboard user who tabs to the grid and presses down gets somewhere.
  if (focus.focused.get() === null && ARROWS.has(event.key)) {
    focus.focusFirst();
    return true;
  }

  switch (event.key) {
    case 'ArrowDown':
      return focus.moveRow(1);
    case 'ArrowUp':
      return focus.moveRow(-1);
    case 'ArrowRight':
      return focus.moveColumn(1);
    case 'ArrowLeft':
      return focus.moveColumn(-1);
    case 'Tab':
      return focus.moveCell(event.shiftKey ? -1 : 1);
    case 'Escape':
      focus.clear();
      return true;
    default:
      return false;
  }
}

const ARROWS = new Set(['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft']);
