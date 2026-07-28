/**
 * The complete set of theme tokens.
 *
 * This is the schema: a theme object may set these keys and no others. Every
 * token maps to one `--tf-*` custom property, and every property the components
 * read appears here — the two are kept in step by a test that scans the source
 * for `var(--tf-…)` and fails on anything undeclared.
 *
 * Tokens are grouped by what they control rather than by CSS property, so a
 * consumer can restyle one concern without hunting through a flat list.
 */
export interface GridTheme {
  // -- Typography -------------------------------------------------------------
  /** Font stack for the whole grid. */
  font?: string;
  /** Base cell font size. */
  fontSize?: string;
  /** Header font size, if it should differ from cells. */
  headerFontSize?: string;
  /** Header font weight. */
  headerFontWeight?: string;

  // -- Metrics ----------------------------------------------------------------
  /** Height of a data row. Also drives how many rows fit in an instance. */
  rowHeight?: string;
  /** Height of the header row. */
  headerHeight?: string;
  /** Horizontal padding inside a cell. */
  cellPaddingX?: string;
  /** Gap between instances in the flow layout. */
  instanceGap?: string;
  /** Corner radius on instances and controls. */
  radius?: string;
  /** Indent applied per tree depth level. */
  treeIndent?: string;

  // -- Surfaces ---------------------------------------------------------------
  /** Behind the whole grid, including the gaps between instances. */
  surface?: string;
  /** An instance's own background. */
  background?: string;
  /** Header background. */
  headerBackground?: string;
  /** Background of an offscreen instance placeholder. */
  placeholderBackground?: string;

  // -- Text -------------------------------------------------------------------
  text?: string;
  textMuted?: string;
  headerText?: string;

  // -- Lines ------------------------------------------------------------------
  /** Instance outlines and the header's bottom rule. */
  border?: string;
  /** Between rows and columns: quieter than `border`. */
  borderSubtle?: string;

  // -- State ------------------------------------------------------------------
  /** Focus ring colour. */
  focus?: string;
  /** Focus ring width. */
  focusWidth?: string;
  /** Background of a selected row. */
  selectionBackground?: string;
  /** Background of a hovered row. */
  hoverBackground?: string;

  // -- Cell flash -------------------------------------------------------------
  /** Flash colour when a value rises. */
  flashUp?: string;
  /** Flash colour when a value falls. */
  flashDown?: string;
  /** Flash colour when direction is unknown or disabled. */
  flashNeutral?: string;
  /** Flash duration, as a CSS time. */
  flashDuration?: string;
}

/** Every valid token name, in declaration order. */
export const THEME_TOKENS = [
  'font',
  'fontSize',
  'headerFontSize',
  'headerFontWeight',
  'rowHeight',
  'headerHeight',
  'cellPaddingX',
  'instanceGap',
  'radius',
  'treeIndent',
  'surface',
  'background',
  'headerBackground',
  'placeholderBackground',
  'text',
  'textMuted',
  'headerText',
  'border',
  'borderSubtle',
  'focus',
  'focusWidth',
  'selectionBackground',
  'hoverBackground',
  'flashUp',
  'flashDown',
  'flashNeutral',
  'flashDuration',
] as const satisfies readonly (keyof GridTheme)[];

export type ThemeToken = (typeof THEME_TOKENS)[number];

const TOKEN_SET: ReadonlySet<string> = new Set(THEME_TOKENS);

/**
 * `rowHeight` → `--tf-row-height`.
 *
 * Derived rather than tabulated, so a new token cannot be added with a
 * mismatched property name.
 */
export function customPropertyFor(token: ThemeToken): string {
  return `--tf-${token.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
}

export interface ThemeValidationIssue {
  readonly token: string;
  readonly message: string;
}

/**
 * Reports unknown keys and values that are not CSS-shaped.
 *
 * A theme is data — it may well arrive from a user preference blob or a saved
 * workspace — so a typo should be reported rather than silently ignored, and a
 * value containing a `;` or a closing brace should never reach a stylesheet.
 */
export function validateTheme(theme: unknown): readonly ThemeValidationIssue[] {
  if (typeof theme !== 'object' || theme === null) {
    return [{ token: '(root)', message: 'Theme must be an object.' }];
  }

  const issues: ThemeValidationIssue[] = [];

  for (const [key, value] of Object.entries(theme)) {
    if (!TOKEN_SET.has(key)) {
      issues.push({ token: key, message: `Unknown theme token "${key}".` });
      continue;
    }
    if (value === undefined) continue;
    if (typeof value !== 'string') {
      issues.push({ token: key, message: `Token "${key}" must be a string.` });
      continue;
    }
    // A declaration separator or a block delimiter would let a value escape the
    // property it is assigned to.
    if (/[;{}]/.test(value)) {
      issues.push({ token: key, message: `Token "${key}" must not contain ";", "{" or "}".` });
    }
  }

  return issues;
}

/** Throws on any issue. Used where a bad theme should fail loudly. */
export function assertValidTheme(theme: unknown): asserts theme is GridTheme {
  const issues = validateTheme(theme);
  if (issues.length === 0) return;
  throw new Error(`Invalid grid theme:\n${issues.map((i) => `  - ${i.message}`).join('\n')}`);
}

/** The `--tf-*` declarations a theme resolves to. Unset tokens are omitted. */
export function themeToCustomProperties(theme: GridTheme): Readonly<Record<string, string>> {
  const declarations: Record<string, string> = {};

  for (const token of THEME_TOKENS) {
    const value = theme[token];
    if (typeof value === 'string' && value !== '') {
      declarations[customPropertyFor(token)] = value;
    }
  }

  return declarations;
}
