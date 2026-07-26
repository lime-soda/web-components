import { customElement } from 'lit/decorators.js';
import { nothing } from 'lit';
import { CellRendererElement } from '../../components/cell-renderer-element.js';
import { type SelectionModule, selectionCheckboxTemplate } from './selection-module.js';

/**
 * The checkbox the selection module puts in its own column.
 *
 * A renderer element rather than a function so it reads its row from context and
 * repaints on its own when selection changes, instead of the whole row doing so.
 */
@customElement('fg-selection-checkbox')
export class FgSelectionCheckbox extends CellRendererElement {
  override render(): unknown {
    const rowId = this.row?.rowId;
    const selection = this.grid?.registry.get<SelectionModule>('selection');
    if (rowId === undefined || !selection) return nothing;

    // Subscribes to module state, so ticking one box repaints the others when
    // the mode is single.
    this.grid?.registry.version.get();

    const selectable = selection.canSelect(rowId, this.row?.meta ?? {});

    return selectionCheckboxTemplate(selection.isSelected(rowId), !selectable, (checked, shift) =>
      selection.handleCheckbox(rowId, checked, shift),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fg-selection-checkbox': FgSelectionCheckbox;
  }
}
