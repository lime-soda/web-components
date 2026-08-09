import fs from 'node:fs/promises';

/**
 * Creates CSS properties block from a properties map
 */
export function createCSSProperties(propsMap, selector = ':root') {
  const declarations = Object.entries(propsMap)
    .map(([prop, value]) => `  ${prop}: ${value};`)
    .join('\n');

  // One real declaration among the custom properties: `accent-color` is what
  // paints a native checkbox, radio or range thumb in its selected state, and
  // there is no way for a token alone to reach those parts. Setting it here
  // means an application's own form controls match the components without
  // anyone wiring it up per control.
  const accent =
    selector === ':root' && '--theme-color-accent' in propsMap
      ? '\n  accent-color: var(--theme-color-accent);'
      : '';

  return `${selector} {\n${declarations}${accent}\n}`;
}

/**
 * Combines light and dark CSS values using light-dark() function
 */
export function combineLightDarkValues(light, dark) {
  const propertiesPattern = /(--[^:]+?):\s*([^;]+?);/g;
  const lightDark = {};

  for (const [, prop, value] of light.matchAll(propertiesPattern)) {
    lightDark[prop] = value;
  }

  for (const [, prop, value] of dark.matchAll(propertiesPattern)) {
    if (!lightDark[prop]) {
      lightDark[prop] = value;
    } else if (lightDark[prop] !== value) {
      lightDark[prop] = `light-dark(${lightDark[prop]}, ${value})`;
    }
  }

  return lightDark;
}

/**
 * Safely copies a file with error handling
 */
export async function copyFile(src, dest) {
  try {
    await fs.copyFile(src, dest);
  } catch (error) {
    throw new Error(`Failed to copy ${src} to ${dest}: ${error.message}`);
  }
}

/**
 * Safely reads a file with error handling
 */
export async function readFile(filePath) {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to read ${filePath}: ${error.message}`);
  }
}

/**
 * Safely writes a file with error handling
 */
export async function writeFile(filePath, content) {
  try {
    await fs.writeFile(filePath, content, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to write ${filePath}: ${error.message}`);
  }
}

/**
 * Safely removes a directory and its contents
 */
export async function removeDirectory(dirPath) {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
  } catch (error) {
    throw new Error(`Failed to remove directory ${dirPath}: ${error.message}`);
  }
}
