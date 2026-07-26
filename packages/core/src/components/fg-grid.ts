import { provide } from '@lit/context';
import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { createRef, ref } from 'lit/directives/ref.js';
import { repeat } from 'lit/directives/repeat.js';
import { GRID_EVENTS } from '../api/events.js';
import type { GridApi } from '../api/types.js';
import { gridContext } from '../context/index.js';
import { GridController, type GridOptions } from '../controller/grid-controller.js';
import { SignalWatcher } from '../reactive/index.js';
import { InstanceVirtualizer } from '../virtualize/instance-virtualizer.js';
import './fg-instance.js';

/**
 * The grid host.
 *
 * Owns the controller, provides it on a context, measures the container, and
 * decides which instances are worth rendering. Everything below reads from the
 * context, so nothing is drilled down the tree.
 */
@customElement('fg-grid')
export class FgGrid<TData = unknown> extends SignalWatcher(LitElement) {
  static override styles = css`
    :host {
      display: block;
      height: 100%;
      overflow: hidden;
      color: var(--fg-text, #101010);
      background: var(--fg-surface, transparent);
      font-family: var(--fg-font, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif);
      font-size: var(--fg-font-size, 13px);
      -webkit-font-smoothing: antialiased;
    }

    .scroller {
      width: 100%;
      height: 100%;
      overflow: auto;
      box-sizing: border-box;
    }

    .scroller[data-layout='flow'] {
      display: flex;
      align-items: flex-start;
      gap: var(--fg-instance-gap, 16px);
      overflow-y: hidden;
    }

    .instance-slot {
      flex: 0 0 auto;
      box-sizing: border-box;
    }

    /* Offscreen instances keep their exact footprint so the scrollbar never jumps. */
    .placeholder {
      box-sizing: border-box;
      background: var(--fg-bg, #ffffff);
      border: 1px solid var(--fg-border, #d8d8d8);
      border-radius: var(--fg-radius, 4px);
    }

    .stack-spacer {
      width: 100%;
    }
  `;

  @property({ attribute: false })
  accessor gridOptions: GridOptions<TData> | undefined;

  @property({ attribute: false })
  accessor rowData: readonly TData[] | undefined;

  @provide({ context: gridContext })
  accessor controller: GridController<TData> | undefined;

  @state()
  private accessor visibleInstances: ReadonlySet<string> = new Set();

  private readonly scrollerRef = createRef<HTMLElement>();
  private virtualizer?: InstanceVirtualizer;
  private resizeObserver?: ResizeObserver;
  // Explicit `| undefined` rather than `?`: exactOptionalPropertyTypes forbids
  // assigning undefined back to an optional property, and these are cleared on
  // teardown.
  private wheelHandler: ((event: WheelEvent) => void) | undefined;
  private scrollHandler: (() => void) | undefined;
  private readyDispatched = false;

  /** Throws until `gridOptions` has been set. */
  get api(): GridApi<TData> {
    if (!this.controller) {
      throw new Error('The grid has no options yet. Set .gridOptions before reading .api.');
    }
    return this.controller.api;
  }

  override willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('gridOptions') && this.gridOptions) {
      if (this.controller) {
        this.controller.setOptions(this.gridOptions);
      } else {
        this.controller = new GridController<TData>(this.gridOptions, (type, detail) =>
          this.emit(type, detail),
        );
      }
    }

    if (changed.has('rowData') && this.rowData && this.controller) {
      this.controller.pipeline.store.setRowData(this.rowData);
    }
  }

  override firstUpdated(): void {
    const scroller = this.scrollerRef.value;
    if (!scroller) return;

    this.resizeObserver = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      this.controller?.setContainerSize(width, height);
    });
    this.resizeObserver.observe(scroller);

    this.virtualizer = new InstanceVirtualizer(
      (visible) => {
        this.visibleInstances = new Set(visible);
      },
      { root: scroller },
    );

    this.syncScrollBehaviour();
    this.dispatchReady();
  }

  override updated(): void {
    this.syncScrollBehaviour();
    this.dispatchReady();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.resizeObserver?.disconnect();
    this.virtualizer?.disconnect();
    this.removeScrollJacking();
    if (this.scrollHandler && this.scrollerRef.value) {
      this.scrollerRef.value.removeEventListener('scroll', this.scrollHandler);
      this.scrollHandler = undefined;
    }
    this.controller?.destroy();
    this.controller = undefined;
    this.readyDispatched = false;
  }

  override render(): unknown {
    const controller = this.controller;
    if (!controller) return nothing;

    const mode = controller.options.layout ?? 'flow';
    const layout = controller.layout.get();
    const viewport = controller.pipeline.viewport;

    // The engine's capacity arithmetic and the CSS that lays rows out must agree.
    // Publishing the configured heights as custom properties is what keeps them
    // in step; leaving CSS on its own default silently overflows every instance.
    return html`
      <div
        class="scroller"
        part="scroller"
        data-layout=${mode}
        role="presentation"
        aria-label=${controller.options.ariaLabel ?? 'Data grid'}
        @keydown=${this.handleKeyDown}
        style="--fg-row-height: ${viewport.rowHeight}px; --fg-header-height: ${viewport.headerHeight}px; --fg-instance-gap: ${viewport.instanceGap}px"
        ${ref(this.scrollerRef)}
      >
        ${mode === 'stack' ? this.renderStack(layout) : this.renderFlow(layout)}
      </div>
    `;
  }

  private renderFlow(layout: ReturnType<GridController<TData>['layout']['get']>): unknown {
    const height = this.controller?.pipeline.viewport.height ?? 0;

    return repeat(
      layout.instances,
      (instance) => instance.id,
      (instance) => html`
        <div
          class="instance-slot"
          data-instance-id=${instance.id}
          style="width: ${instance.width}px; height: ${height}px;"
          ${ref((element) => this.observeSlot(element))}
        >
          ${
            this.visibleInstances.has(instance.id)
              ? html`<fg-instance part="instance" .instance=${instance}></fg-instance>`
              : html`<div
                  class="placeholder"
                  style="width: ${instance.width}px; height: ${height}px;"
                ></div>`
          }
        </div>
      `,
    );
  }

  private renderStack(layout: ReturnType<GridController<TData>['layout']['get']>): unknown {
    const instance = layout.instances[0];
    if (!instance) return nothing;

    // Spacers above and below stand in for the rows outside the window, so the
    // scrollbar reflects the full dataset rather than what is realised.
    const below = Math.max(
      0,
      layout.totalHeight -
        instance.offset -
        instance.rows.length * (this.controller?.options.rowHeight ?? 32),
    );

    return html`
      <div class="stack-spacer" style="height: ${instance.offset}px"></div>
      <fg-instance part="instance" .instance=${instance}></fg-instance>
      <div class="stack-spacer" style="height: ${below}px"></div>
    `;
  }

  /**
   * Offers keys to modules. Core binds nothing itself: with no keyboard module
   * installed the grid has no key behaviour at all, which is the point.
   */
  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (this.controller?.registry.handleKeyDown(event) === true) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  private observeSlot(element: Element | undefined): void {
    if (!element || !this.virtualizer) return;
    this.virtualizer.observe(element);
  }

  private syncScrollBehaviour(): void {
    const scroller = this.scrollerRef.value;
    const controller = this.controller;
    if (!scroller || !controller) return;

    const wantsJacking =
      (controller.options.enableScrollJacking ?? false) &&
      (controller.options.layout ?? 'flow') === 'flow';

    if (wantsJacking && !this.wheelHandler) {
      this.wheelHandler = (event: WheelEvent) => {
        // Only redirect a pure vertical gesture: a trackpad's horizontal
        // component must keep working normally.
        if (event.deltaY === 0 || event.deltaX !== 0) return;
        event.preventDefault();
        scroller.scrollLeft += event.deltaY;
      };
      scroller.addEventListener('wheel', this.wheelHandler, { passive: false });
    } else if (!wantsJacking && this.wheelHandler) {
      this.removeScrollJacking();
    }

    // The stack engine windows rows from the scroll position, so it needs to know.
    const needsScrollTracking = (controller.options.layout ?? 'flow') === 'stack';
    if (needsScrollTracking && !this.scrollHandler) {
      this.scrollHandler = () => {
        controller.pipeline.setViewport({
          ...controller.pipeline.viewport,
          scrollOffset: scroller.scrollTop,
        });
      };
      scroller.addEventListener('scroll', this.scrollHandler, { passive: true });
    }
  }

  private removeScrollJacking(): void {
    const scroller = this.scrollerRef.value;
    if (scroller && this.wheelHandler) scroller.removeEventListener('wheel', this.wheelHandler);
    this.wheelHandler = undefined;
  }

  private dispatchReady(): void {
    if (this.readyDispatched || !this.controller) return;
    this.readyDispatched = true;
    this.emit(GRID_EVENTS.READY, { api: this.controller.api });
  }

  private emit(type: string, detail: unknown): void {
    if (type === 'fg-scroll-to-row') {
      this.scrollToRow((detail as { id: string }).id);
      return;
    }
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }

  private scrollToRow(id: string): void {
    const scroller = this.scrollerRef.value;
    const layout = this.controller?.layout.get();
    if (!scroller || !layout) return;

    const instance = layout.instances.find((candidate) =>
      candidate.rows.some((row) => row.rowId === id),
    );
    if (!instance) return;

    if ((this.controller?.options.layout ?? 'flow') === 'stack') {
      scroller.scrollTop = instance.offset;
    } else {
      scroller.scrollLeft = instance.offset;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fg-grid': FgGrid;
  }
}
