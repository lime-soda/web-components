/**
 * Role queries that cross shadow boundaries.
 *
 * Testing Library stops at a shadow root, and this grid nests four of them —
 * grid, instance, row, cell — so `getByRole('gridcell')` from the canvas finds
 * nothing at all. Every query below walks the composed tree instead, which is
 * what the accessibility tree does and therefore what a screen reader sees.
 *
 * Deliberately small. It resolves the roles this grid actually uses and the
 * implicit roles of the controls modules put inside it, rather than
 * reimplementing role resolution: an unknown element simply has no role, which
 * fails a query loudly instead of matching the wrong thing.
 */

/** Implicit roles for the elements modules render into cells and headers. */
const IMPLICIT: Record<string, string> = {
  BUTTON: 'button',
  A: 'link',
  SELECT: 'combobox',
  TEXTAREA: 'textbox',
};

function implicitInputRole(element: HTMLInputElement): string {
  if (element.type === 'checkbox') return 'checkbox';
  if (element.type === 'radio') return 'radio';
  // A search input is a searchbox, not a textbox. Answering `textbox` here
  // meant a query for the filter box found nothing and a query for a text box
  // found the filter, both quietly.
  if (element.type === 'search') return 'searchbox';
  if (element.type === 'number') return 'spinbutton';
  return 'textbox';
}

export function roleOf(element: Element): string | null {
  const explicit = element.getAttribute('role');
  if (explicit) return explicit;
  if (element instanceof HTMLInputElement) return implicitInputRole(element);
  return IMPLICIT[element.tagName] ?? null;
}

/**
 * Every element beneath a node, descending through shadow roots.
 *
 * Including the node's own: a row keeps its cells in its shadow root, so
 * walking only the light children of a row finds nothing at all.
 */
export function* deepElements(root: ParentNode): Generator<Element> {
  if (root instanceof Element && root.shadowRoot) yield* deepElements(root.shadowRoot);
  for (const child of root.children) {
    yield child;
    // Recursing is enough: the line above takes this child's shadow root when
    // the call reaches it. Descending into it here as well visited every nested
    // root once per level of nesting, which multiplied the counts.
    yield* deepElements(child);
  }
}

/**
 * What a screen reader would call this element.
 *
 * `aria-label` wins, then the text — read through shadow roots, because a cell
 * keeps its content in its own and `textContent` on the host returns nothing.
 */
export function accessibleName(element: Element): string {
  const label = element.getAttribute('aria-label');
  if (label) return label.trim();
  return deepText(element).replaceAll(/\s+/g, ' ').trim();
}

/** Text as rendered, following shadow roots and slotted content alike. */
function deepText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';

  let text = '';
  if (node instanceof Element && node.shadowRoot) text += deepText(node.shadowRoot);
  for (const child of node.childNodes) text += deepText(child);
  return text;
}

type NameMatcher = string | RegExp;

const matches = (name: string, matcher: NameMatcher | undefined): boolean => {
  if (matcher === undefined) return true;
  return typeof matcher === 'string' ? name === matcher : matcher.test(name);
};

export interface RoleOptions {
  name?: NameMatcher;
  /** Only elements currently in the accessibility tree. On by default. */
  includeHidden?: boolean;
}

const hidden = (element: Element): boolean => {
  for (let node: Element | null = element; node; node = parentOf(node)) {
    if (node.getAttribute('aria-hidden') === 'true') return true;
    if (node instanceof HTMLElement && node.inert) return true;
  }
  return false;
};

const parentOf = (element: Element): Element | null =>
  element.parentElement ?? (element.getRootNode() as ShadowRoot).host ?? null;

export function queryAllByRole(
  root: ParentNode,
  role: string,
  { name, includeHidden = false }: RoleOptions = {},
): HTMLElement[] {
  const found: HTMLElement[] = [];
  for (const element of deepElements(root)) {
    if (roleOf(element) !== role) continue;
    if (!includeHidden && hidden(element)) continue;
    if (!matches(accessibleName(element), name)) continue;
    found.push(element as HTMLElement);
  }
  return found;
}

export function getAllByRole(root: ParentNode, role: string, options?: RoleOptions): HTMLElement[] {
  const found = queryAllByRole(root, role, options);
  if (found.length === 0) {
    throw new Error(
      `No element with role "${role}"${options?.name ? ` and name ${String(options.name)}` : ''}. ` +
        `Roles present: ${[...new Set([...deepElements(root)].map(roleOf).filter(Boolean))].join(', ') || 'none'}`,
    );
  }
  return found;
}

export function getByRole(root: ParentNode, role: string, options?: RoleOptions): HTMLElement {
  const found = getAllByRole(root, role, options);
  if (found.length > 1) {
    throw new Error(
      `Found ${found.length} elements with role "${role}"` +
        `${options?.name ? ` and name ${String(options.name)}` : ''}; expected one.`,
    );
  }
  return found[0]!;
}

/** Polls until the query succeeds, for anything that mounts asynchronously. */
export async function findAllByRole(
  root: ParentNode,
  role: string,
  options?: RoleOptions,
  { timeout = 3000 } = {},
): Promise<HTMLElement[]> {
  const deadline = Date.now() + timeout;
  for (;;) {
    const found = queryAllByRole(root, role, options);
    if (found.length > 0) return found;
    if (Date.now() > deadline) return getAllByRole(root, role, options);
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
}

export async function findByRole(
  root: ParentNode,
  role: string,
  options?: RoleOptions,
): Promise<HTMLElement> {
  await findAllByRole(root, role, options);
  return getByRole(root, role, options);
}

/**
 * The grid's rows in visual order, excluding the header row.
 *
 * And excluding the sticky band. The stack layout redraws the heading of the
 * group being scrolled through in a pinned strip above the rows, so that row
 * appears twice to a query — once where it lives and once as context. Counting
 * it makes a filtered grid look like it kept a row it dropped.
 */
export const dataRows = (root: ParentNode): HTMLElement[] =>
  queryAllByRole(root, 'row')
    .filter((row) => row.tagName === 'LS-GRID-ROW')
    .filter((row) => !inStickyBand(row));

const inStickyBand = (element: Element): boolean => {
  for (let node: Element | null = element; node; node = parentOf(node)) {
    if (node.classList?.contains('stack-sticky')) return true;
  }
  return false;
};

/** The cells of one row, in column order. */
export const cellsOf = (row: ParentNode): HTMLElement[] => queryAllByRole(row, 'gridcell');

/** The element that really has focus, following shadow roots down. */
export function activeElement(): Element | null {
  let node: Element | null = document.activeElement;
  while (node?.shadowRoot?.activeElement) node = node.shadowRoot.activeElement;
  return node;
}

/**
 * Presses a key on whatever currently has focus.
 *
 * `userEvent.keyboard` dispatches at `document.activeElement`, which for a web
 * component is the host — never the element inside the shadow root that the
 * user is actually on. A browser dispatches at the focused element itself and
 * lets the event compose upward, so a handler bound to the host sees a path
 * that starts at the cell. Dispatching at the host instead produces a path that
 * starts at the host, and a grid that asks what was focused finds the wrong
 * answer: the arrow keys did nothing at all.
 *
 * This is the browser's sequence, addressed correctly. Everything else — clicks,
 * pointer drags, tabbing — goes through `userEvent`, which handles shadow roots
 * because it works from coordinates and real focus.
 */
export async function pressKey(key: string, init: KeyboardEventInit = {}): Promise<boolean> {
  const target = activeElement() ?? document.body;
  const shared = { key, bubbles: true, composed: true, cancelable: true, ...init };

  const event = new KeyboardEvent('keydown', shared);
  target.dispatchEvent(event);
  target.dispatchEvent(new KeyboardEvent('keyup', shared));
  await new Promise((resolve) => requestAnimationFrame(resolve));

  // Whether anything claimed the key. A synthetic event cannot make the browser
  // perform its own default — moving focus out of the grid on Tab, say — so
  // this is how a test sees that the grid declined to handle it and left the
  // browser to.
  return event.defaultPrevented;
}

/**
 * Types into a text box, character by character.
 *
 * `userEvent.type` sends its keystrokes to `document.activeElement`, which for
 * a web component is the host and not the element inside the shadow root. It
 * reaches a filter box three roots down; a cell editor is five, and there the
 * keystrokes land on the host and the input never sees them. Nothing throws —
 * the box simply keeps the value it opened with, so only a test that checks the
 * value afterwards notices. `userEvent.clear` fails the same way but loudly:
 * "the element to be cleared could not be focused".
 *
 * This is the sequence a browser performs, addressed at the input itself:
 * keydown, the value edit the keystroke causes, an `input` event describing it,
 * keyup. Existing text is selected first, because that is the state opening an
 * editor leaves the box in and typing over a selection replaces it.
 *
 * The same compromise as `pressKey`, for the same reason, and the two should be
 * read together.
 */
export async function typeInto(input: HTMLInputElement, text: string): Promise<void> {
  input.focus();
  input.setSelectionRange(0, input.value.length);

  for (const character of text) {
    const shared = { key: character, bubbles: true, composed: true, cancelable: true };
    input.dispatchEvent(new KeyboardEvent('keydown', shared));

    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    input.value = input.value.slice(0, start) + character + input.value.slice(end);
    input.setSelectionRange(start + 1, start + 1);

    input.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        composed: true,
        data: character,
        inputType: 'insertText',
      }),
    );
    input.dispatchEvent(new KeyboardEvent('keyup', shared));
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
}

/**
 * Puts focus where Tab would put it.
 *
 * `userEvent.tab()` walks the document's focusable elements and cannot see into
 * a shadow root, so it steps straight past the grid to whatever follows —
 * focus never enters at all. A browser does traverse shadow trees, landing on
 * the one cell holding the roving tabindex, which is what this focuses.
 */
export function tabInto(root: ParentNode): HTMLElement {
  for (const element of deepElements(root)) {
    if (element.getAttribute('tabindex') === '0') {
      (element as HTMLElement).focus();
      return element as HTMLElement;
    }
  }
  throw new Error('Nothing in this tree holds the roving tabindex.');
}

/**
 * Waits until every Lit element in the tree has finished rendering.
 *
 * A cell exists before the custom element inside it does: the grid renders the
 * cell, the cell renders its renderer, and each is a separate update. Querying
 * after the cells appear therefore finds a grid whose controls are still being
 * built — five selection checkboxes with one input between them — and a story
 * that measures that is measuring a half-drawn grid.
 *
 * Repeated because settling one level reveals the next: awaiting the cells lets
 * the renderers start, and those have their own updates to finish.
 */
export async function settleRenders(root: ParentNode, passes = 5): Promise<void> {
  for (let pass = 0; pass < passes; pass += 1) {
    const pending = [...deepElements(root)]
      .map((element) => (element as { updateComplete?: Promise<unknown> }).updateComplete)
      .filter((update): update is Promise<unknown> => update !== undefined);

    if (pending.length === 0) break;
    await Promise.all(pending);
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
}

/** The grid mounted and fully drawn: cells present, and their contents with them. */
export async function gridReady(root: ParentNode): Promise<void> {
  await findAllByRole(root, 'gridcell');
  await settleRenders(root);
}

/**
 * A cell's own value, without the controls a module put beside it.
 *
 * The accessible name of a cell includes everything in it, which is correct —
 * a screen reader reads the expander too. But a test comparing values wants the
 * value, and `▶ Group 0` matching `Group 0` is a comparison nobody wants to
 * write twice.
 */
export function cellText(cell: Element): string {
  const content = [...deepElements(cell)].find(
    (element) => element.getAttribute('part') === 'cell-content',
  );
  return accessibleName(content ?? cell);
}
