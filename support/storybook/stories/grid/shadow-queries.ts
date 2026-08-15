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

/** The grid's rows in visual order, excluding the header row. */
export const dataRows = (root: ParentNode): HTMLElement[] =>
  queryAllByRole(root, 'row').filter((row) => row.tagName === 'LS-GRID-ROW');

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
export async function pressKey(key: string, init: KeyboardEventInit = {}): Promise<void> {
  const target = activeElement() ?? document.body;
  const shared = { key, bubbles: true, composed: true, cancelable: true, ...init };

  target.dispatchEvent(new KeyboardEvent('keydown', shared));
  target.dispatchEvent(new KeyboardEvent('keyup', shared));
  await new Promise((resolve) => requestAnimationFrame(resolve));
}
