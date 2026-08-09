import StyleDictionary from 'style-dictionary';
import { transforms } from 'style-dictionary/enums';

/**
 * Groups tokens by path segments for structured exports
 * Separates single-level tokens from grouped tokens
 */
export function groupTokensByPath(tokens, options) {
  const groups = {};
  const singleLevelTokens = {};

  /** The custom property Style Dictionary declares for this token. */
  const cssVarFor = (token) =>
    `--${String(StyleDictionary.hooks.transforms[transforms.nameKebab].transform(token, options))}`;

  tokens.forEach((token) => {
    const [, groupKey, ...rest] = token.path;
    if (!groupKey) return;

    if (rest.length === 0) {
      singleLevelTokens[groupKey] = {
        // Joining the path left a camelCase name — `--grid-fontSize` — while the
        // props block declares the kebab-case `--grid-font-size`, so every
        // single-level token exported a variable that was never defined. Only a
        // component with tokens at the top level hits this; the button's are all
        // nested a level down.
        cssVar: cssVarFor(token),
        token,
      };
      return;
    }

    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }

    const propName = StyleDictionary.hooks.transforms[transforms.nameCamel].transform(
      { path: rest },
      options,
    );
    groups[groupKey].push({
      propName,
      cssVar: cssVarFor(token),
      token,
    });
  });

  return { groups, singleLevelTokens };
}
