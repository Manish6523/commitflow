/** A codicon and colour for a file, standing in for the editor's file icon theme. */
const ICONS: [RegExp, string, string][] = [
  [/(^|\/)package(-lock)?\.json$|\.lock$|(^|\/)pnpm-lock\.yaml$/i, 'lock', '#cbcb41'],
  [/\.(ts|tsx|mts|cts)$/i, 'file-code', '#3178c6'],
  [/\.(js|jsx|mjs|cjs)$/i, 'file-code', '#cbcb41'],
  [/\.(py|pyi)$/i, 'file-code', '#3572a5'],
  [/\.(go|rs|java|kt|c|cc|cpp|h|hpp|cs|rb|php|swift|dart|lua|sh|bash|zsh|ps1)$/i, 'file-code', '#a074c4'],
  [/\.(html?|vue|svelte|astro)$/i, 'file-code', '#e44d26'],
  [/\.(css|scss|sass|less)$/i, 'file-code', '#563d7c'],
  [/\.(json|jsonc|ya?ml|toml|ini|env.*)$/i, 'json', '#cbcb41'],
  [/\.(md|mdx|markdown|rst|txt|adoc)$/i, 'markdown', '#519aba'],
  [/\.(png|jpe?g|gif|svg|webp|ico|bmp|avif|mp4|mov|webm|mp3|wav)$/i, 'file-media', '#a074c4'],
  [/\.(zip|gz|tgz|tar|7z|rar|vsix|jar)$/i, 'file-zip', '#8a8a8a'],
  [/\.pdf$/i, 'file-pdf', '#e44d26'],
  [/(^|\/)(\.gitignore|\.gitattributes|\.editorconfig|\.npmrc|\.nvmrc|dockerfile|makefile)$|\.config\.[cm]?[jt]s$/i, 'gear', '#8a8a8a'],
];

export function fileIcon(path: string): { icon: string; color: string } {
  const match = ICONS.find(([pattern]) => pattern.test(path));
  return match ? { icon: match[1], color: match[2] } : { icon: 'file', color: 'var(--vscode-icon-foreground)' };
}
