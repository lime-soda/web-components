import { describe, expect, it } from 'vitest';
import {
  THEME_TOKENS,
  assertValidTheme,
  customPropertyFor,
  themeToCustomProperties,
  validateTheme,
} from './tokens.js';

describe('theme tokens', () => {
  describe('customPropertyFor', () => {
    it('converts camelCase to a kebab-case custom property', () => {
      expect(customPropertyFor('rowHeight')).toBe('--tf-row-height');
      expect(customPropertyFor('selectionBackground')).toBe('--tf-selection-background');
    });

    it('leaves a single-word token alone', () => {
      expect(customPropertyFor('surface')).toBe('--tf-surface');
    });

    it('produces a unique property for every token', () => {
      const properties = THEME_TOKENS.map(customPropertyFor);

      expect(new Set(properties).size).toBe(properties.length);
    });
  });

  describe('validateTheme', () => {
    it('accepts an empty theme', () => {
      expect(validateTheme({})).toEqual([]);
    });

    it('accepts every declared token', () => {
      const theme = Object.fromEntries(THEME_TOKENS.map((token) => [token, 'red']));

      expect(validateTheme(theme)).toEqual([]);
    });

    it('rejects an unknown token by name, so a typo is not silently ignored', () => {
      const issues = validateTheme({ rowHeght: '28px' });

      expect(issues).toHaveLength(1);
      expect(issues[0]!.message).toContain('rowHeght');
    });

    it('rejects a non-string value', () => {
      expect(validateTheme({ rowHeight: 28 })).toHaveLength(1);
    });

    it('ignores an explicitly undefined token', () => {
      expect(validateTheme({ rowHeight: undefined })).toEqual([]);
    });

    it('rejects a value containing a declaration separator', () => {
      // Otherwise a value could escape its property and inject declarations.
      expect(validateTheme({ background: 'red; position: fixed' })).toHaveLength(1);
    });

    it('rejects a value containing block delimiters', () => {
      expect(validateTheme({ background: 'red} body {display:none' })).toHaveLength(1);
    });

    it('accepts values with parentheses, commas and slashes', () => {
      const theme = {
        background: 'rgb(59 130 246 / 18%)',
        font: 'system-ui, -apple-system, sans-serif',
        flashDuration: '600ms',
      };

      expect(validateTheme(theme)).toEqual([]);
    });

    it('rejects a non-object', () => {
      expect(validateTheme('red')).toHaveLength(1);
      expect(validateTheme(null)).toHaveLength(1);
    });

    it('reports every problem at once rather than only the first', () => {
      expect(validateTheme({ nope: 'a', alsoNope: 'b', rowHeight: 3 })).toHaveLength(3);
    });
  });

  describe('assertValidTheme', () => {
    it('passes a valid theme', () => {
      expect(() => assertValidTheme({ rowHeight: '28px' })).not.toThrow();
    });

    it('throws naming the offending token', () => {
      expect(() => assertValidTheme({ rowHeght: '28px' })).toThrow(/rowHeght/);
    });
  });

  describe('themeToCustomProperties', () => {
    it('maps set tokens to custom properties', () => {
      expect(themeToCustomProperties({ rowHeight: '28px', text: '#eee' })).toEqual({
        '--tf-row-height': '28px',
        '--tf-text': '#eee',
      });
    });

    it('omits unset tokens, so the stylesheet default applies', () => {
      expect(themeToCustomProperties({})).toEqual({});
    });

    it('omits an empty string rather than emitting an empty declaration', () => {
      expect(themeToCustomProperties({ text: '' })).toEqual({});
    });
  });
});
