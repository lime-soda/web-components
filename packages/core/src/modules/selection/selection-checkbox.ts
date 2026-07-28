import { css, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import { CellRendererElement } from '../../components/cell-renderer-element.js';
import { type SelectionModule, selectionCheckboxTemplate } from './selection-module.js';

/**
 * The checkbox the selection module puts in its own column.
 *
 * A renderer element rather than a function so it reads its row from context and
 * repaints on its own when selection changes, instead of the whole row doing so.
 */
@customElement('flow-selection-checkbox')
export class FlowSelectionCheckbox extends CellRendererElement {
  static override styles = css`
    /*
     * Fills the cell and centres the control. The cell drops its own padding for
     * element renderers, so the whole column width is available to centre in.
     */
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
    }
  `;

  override render(): unknown {
    const rowId = this.row?.rowId;
    const selection = this.grid?.registry.get<SelectionModule>('selection');
    if (rowId === undefined || !selection) return nothing;

    // Subscribes to module state, so ticking one box repaints the others when
    // the mode is single.
    this.grid?.registry.version.get();

    return selectionCheckboxTemplate(
      selection.getRowState(rowId),
      !selection.isRowSelectable(rowId),
      (checked, shift) => selection.handleCheckbox(rowId, checked, shift),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'flow-selection-checkbox': FlowSelectionCheckbox;
  }
}
