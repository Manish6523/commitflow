import * as monaco from 'monaco-editor/editor/editor.api';
// Syntax highlighting for every language, each loaded on first use. The
// TypeScript/JSON/CSS/HTML language services are left out: a read-only diff
// doesn't need them and they are most of Monaco's size.
import 'monaco-editor/languages/definitions/register.all';
import 'monaco-editor/features/bracketMatching/register';
import 'monaco-editor/features/clipboard/register';
import 'monaco-editor/features/codicon/register';
import 'monaco-editor/features/contextmenu/register';
import 'monaco-editor/features/diffEditor/register';
import 'monaco-editor/features/find/register';
import 'monaco-editor/features/folding/register';
import 'monaco-editor/features/hover/register';
import 'monaco-editor/features/stickyScroll/register';
import 'monaco-editor/features/wordHighlighter/register';
// Inlined as a blob: a webview can't start a worker from a vscode-resource URL.
import EditorWorker from 'monaco-editor/editor/editor.worker?worker&inline';
import { cssVariableFor, toHexColor } from './themeColors';

(self as any).MonacoEnvironment = { getWorker: () => new EditorWorker() };

const THEME_NAME = 'commitflow';

const THEME_COLOR_KEYS = [
  'editor.background',
  'editor.foreground',
  'editor.selectionBackground',
  'editor.inactiveSelectionBackground',
  'editor.lineHighlightBackground',
  'editor.findMatchBackground',
  'editor.findMatchHighlightBackground',
  'editorCursor.foreground',
  'editorGutter.background',
  'editorLineNumber.foreground',
  'editorLineNumber.activeForeground',
  'editorWidget.background',
  'editorWidget.border',
  'editorStickyScroll.background',
  'diffEditor.insertedTextBackground',
  'diffEditor.removedTextBackground',
  'diffEditor.insertedLineBackground',
  'diffEditor.removedLineBackground',
  'diffEditor.border',
  'diffEditor.diagonalFill',
  'diffEditor.unchangedRegionBackground',
  'diffEditor.unchangedRegionForeground',
  'diffEditorGutter.insertedLineBackground',
  'diffEditorGutter.removedLineBackground',
  'input.background',
  'input.foreground',
  'input.border',
  'scrollbarSlider.background',
  'scrollbarSlider.hoverBackground',
  'scrollbarSlider.activeBackground',
];

function baseTheme(): monaco.editor.BuiltinTheme {
  const { classList } = document.body;
  if (classList.contains('vscode-high-contrast-light')) return 'hc-light';
  if (classList.contains('vscode-high-contrast')) return 'hc-black';
  return classList.contains('vscode-light') ? 'vs' : 'vs-dark';
}

function applyTheme(): void {
  const styles = getComputedStyle(document.documentElement);
  const colors: Record<string, string> = {};
  for (const key of THEME_COLOR_KEYS) {
    const hex = toHexColor(styles.getPropertyValue(cssVariableFor(key)));
    if (hex) colors[key] = hex;
  }

  monaco.editor.defineTheme(THEME_NAME, { base: baseTheme(), inherit: true, rules: [], colors });
  monaco.editor.setTheme(THEME_NAME);
}

applyTheme();

// VS Code swaps the body class and the variables when the color theme changes.
const themeObserver = new MutationObserver(applyTheme);
themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });

export function editorFont(): { fontFamily?: string; fontSize?: number } {
  const styles = getComputedStyle(document.documentElement);
  const fontFamily = styles.getPropertyValue('--vscode-editor-font-family').trim();
  const fontSize = parseFloat(styles.getPropertyValue('--vscode-editor-font-size'));
  return {
    fontFamily: fontFamily || undefined,
    fontSize: Number.isFinite(fontSize) ? fontSize : undefined,
  };
}

export function languageForPath(filePath: string): string {
  const fileName = (filePath.split('/').pop() || '').toLowerCase();
  const language = monaco.languages.getLanguages().find(
    (lang) =>
      lang.filenames?.some((name) => name.toLowerCase() === fileName) ||
      lang.extensions?.some((ext) => fileName.endsWith(ext.toLowerCase()))
  );
  return language?.id ?? 'plaintext';
}

export { monaco };
