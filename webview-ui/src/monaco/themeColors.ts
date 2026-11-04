/**
 * Monaco only accepts #rrggbb/#rrggbbaa theme colors, while VS Code's CSS
 * variables can also be #rgb, rgb() or rgba(). Returns undefined for anything else.
 */
export function toHexColor(value: string): string | undefined {
  const color = value.trim();
  if (/^#([0-9a-f]{6}|[0-9a-f]{8})$/i.test(color)) return color;
  if (/^#[0-9a-f]{3,4}$/i.test(color)) return color.replace(/[0-9a-f]/gi, '$&$&');

  const match = color.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/i);
  if (!match) return undefined;

  const hex = (n: number) => Math.round(n).toString(16).padStart(2, '0');
  const [, r, g, b, a] = match;
  const rgb = `#${hex(+r)}${hex(+g)}${hex(+b)}`;
  if (a === undefined) return rgb;
  const alpha = a.endsWith('%') ? parseFloat(a) / 100 : parseFloat(a);
  return `${rgb}${hex(alpha * 255)}`;
}

/** VS Code exposes the theme color `a.b` as the CSS variable `--vscode-a-b`. */
export function cssVariableFor(colorKey: string): string {
  return `--vscode-${colorKey.replace(/\./g, '-')}`;
}
