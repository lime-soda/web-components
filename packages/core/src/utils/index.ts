export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function getColorValue(color: string, shade?: number): string {
  const [colorName, colorShade] = color.split('-');
  const shadeValue = shade || parseInt(colorShade) || 500;
  return `var(--color-${colorName}-${shadeValue})`;
}

export function getSpacingValue(size: string | number): string {
  return `var(--spacing-${size})`;
}