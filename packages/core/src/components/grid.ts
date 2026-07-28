import { provide } from '@lit/context';
import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { createRef, ref } from 'lit/directives/ref.js';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';
import { themeToCustomProperties } from '../theme/tokens.js';
import { GRID_EVENTS } from '../api/events.js';
import type { GridApi } from '../api/types.js';
import { gridContext } from '../context/index.js';
import { GridController, type GridOptions } from '../controller/grid-controller.js';
import { SignalWatcher } from '../reactive/index.js';
import { InstanceVirtualizer } from '../virtualize/instance-virtualizer.js';
import './instance.js';

/**
 * The grid host.
 *
 * Owns the controller, provides it on a context, measures the container, and
 * decides which instances are worth rendering. Everything below reads from the
 * context, so nothing is drilled down the tree.
 */
@customElement('flow-grid')
export class FlowGrid<TData = unknown> extends SignalWatcher(LitElement) {
  static override styles = css`
    :host {
      display: block;
      height: 100%;
      overflow: hidden;
      color: var(--flow-text, #101010);
      background: var(--flow-surface, transparent);
      font-family: var(--flow-font, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif);
      font-size: var(--flow-font-size, 13px);
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
      gap: var(--flow-instance-gap, 16px);
      overflow-y: hidden;
    }

    .instance-slot {
      flex: 0 0 auto;
      box-sizing: border-box;
      width: var(--flow-instance-width, auto);
      height: var(--flow-instance-height, auto);
    }

    /* Offscreen instances keep their exact footprint so the scrollbar never jumps. */
    .placeholder {
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      background: var(--flow-placeholder-background, var(--flow-background, #ffffff));
      border: 1px solid var(--flow-border, #d8d8d8);
      border-radius: var(--flow-radius, 4px);
    }

    .stack-spacer {
      width: 100%;
      height: var(--flow-spacer-height, 0);
    }

    /*
     * Only the body scrolls. Sticky rather than fixed so the header still scrolls
     * horizontally with the columns when the grid is wider than its container.
     */
    .stack-header {
      position: sticky;
      top: 0;
      z-index: 2;
    }

    /*
     * Pinned group headings, directly beneath the column header.
     *
     * The negative margin takes the band out of the flow so it overlays the rows
     * passing beneath rather than displacing them — otherwise every row would be
     * pushed down by the depth of the current group, and shift as that changed.
     */
    .stack-sticky {
      position: sticky;
      top: var(--flow-header-height, 32px);
      z-index: 1;
      margin-bottom: calc(-1 * var(--flow-sticky-height, 0px));
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
        style=${styleMap(this.scrollerProperties())}
        ${ref(this.scrollerRef)}
      >
        ${mode === 'stack' ? this.renderStack(layout) : this.renderFlow(layout)}
      </div>
    `;
  }

  /**
   * Custom properties for the scroller: the consumer's theme, then the measured
   * geometry.
   *
   * Geometry wins deliberately. `rowHeight` is what the layout engine used to
   * decide how many rows fit an instance, so CSS must lay rows out at exactly
   * that height or every instance quietly overflows — a theme cannot be allowed
   * to disagree with the arithmetic. Everything else the theme owns outright.
   */
  private scrollerProperties(): Record<string, string> {
    const controller = this.controller;
    if (!controller) return {};

    const viewport = controller.pipeline.viewport;
    return {
      ...themeToCustomProperties(controller.options.theme ?? {}),
      '--flow-row-height': `${viewport.rowHeight}px`,
      '--flow-header-height': `${viewport.headerHeight}px`,
      '--flow-instance-gap': `${viewport.instanceGap}px`,
    };
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
          style=${styleMap({
            '--flow-instance-width': `${instance.width}px`,
            '--flow-instance-height': `${height}px`,
          })}
          ${ref((element) => this.observeSlot(element))}
        >
          ${
            this.visibleInstances.has(instance.id)
              ? html`<flow-instance part="instance" .instance=${instance}></flow-instance>`
              : html`<div class="placeholder" part="placeholder"></div>`
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

    // Group headings for the rows currently in view, pinned under the column
    // header. These are the topmost visible row's ancestors — the same chain the
    // flow layout re-emits at a break — so core pins them without knowing what a
    // group is.
    const stickyRows = layout.stickyRows ?? [];
    const rowHeight = this.controller?.pipeline.viewport.rowHeight ?? 32;

    // The header is a sibling of the windowed rows, not a band inside them.
    // Inside, it would ride down with the spacer that positions the window and
    // scroll away; here it sticks to the top of the scroller. Both bands read the
    // same column template, so they stay aligned with nothing measured.
    return html`
      <flow-instance
        class="stack-header"
        part="instance-header"
        parts="header"
        .instance=${instance}
      ></flow-instance>
      ${
        stickyRows.length === 0
          ? nothing
          : html`<flow-instance
              class="stack-sticky"
              part="instance-sticky"
              parts="rows"
              .instance=${{ ...instance, id: `${instance.id}-sticky`, rows: stickyRows }}
              style=${styleMap({
                '--flow-sticky-height': `${stickyRows.length * rowHeight}px`,
              })}
            ></flow-instance>`
      }
      <div
        class="stack-spacer"
        style=${styleMap({ '--flow-spacer-height': `${instance.offset}px` })}
      ></div>
      <flow-instance part="instance" parts="rows" .instance=${instance}></flow-instance>
      <div class="stack-spacer" style=${styleMap({ '--flow-spacer-height': `${below}px` })}></div>
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
    if (type === 'flow-scroll-to-row') {
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
    'flow-grid': FlowGrid;
  }
}
