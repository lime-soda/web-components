import type { PinPlacement } from '../columns/pinning.js';

/**
 * Sticks a cell or header cell to its edge, or releases it.
 *
 * Shared because a header cell and the body cells beneath it have to agree to
 * the pixel: they are separate elements in separate rows, and a column that
 * stops in two different places reads as a rendering fault rather than as one
 * pinned column.
 *
 * The offset is written as an inline style rather than a class because it is a
 * measurement — it changes whenever a column to its left is resized — and there
 * is no fixed set of values to enumerate in a stylesheet.
 */
export function applyPinning(host: HTMLElement, placement: PinPlacement | undefined): void {
  host.style.removeProperty('left');
  host.style.removeProperty('right');

  if (!placement) {
    host.removeAttribute('data-pinned');
    host.removeAttribute('data-pin-edge');
    return;
  }

  host.setAttribute('data-pinned', placement.side);
  host.toggleAttribute('data-pin-edge', placement.edge);
  host.style.setProperty(placement.side, `${placement.offset}px`);
}
