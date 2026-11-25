import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { FileIcon, IconFont } from '../types/protocol';
import { IconTheme, buildLanguageMap } from './iconTheme';

/** Reads the file icon theme chosen in VS Code, so the sidebar can show the same icons. */
export class IconThemeService implements vscode.Disposable {
  private theme: IconTheme | null | undefined;
  private readonly changed = new vscode.EventEmitter<void>();
  public readonly onDidChange = this.changed.event;
  private readonly disposables: vscode.Disposable[];

  constructor() {
    const reload = () => {
      this.theme = undefined;
      this.changed.fire();
    };
    this.disposables = [
      this.changed,
      vscode.workspace.onDidChangeConfiguration((e) => e.affectsConfiguration('workbench.iconTheme') && reload()),
      vscode.window.onDidChangeActiveColorTheme(reload),
      vscode.extensions.onDidChange(reload),
    ];
  }

  public dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }

  public icons(paths: Iterable<string>): Record<string, FileIcon> {
    const theme = this.current();
    const icons: Record<string, FileIcon> = {};
    if (!theme) return icons;
    for (const filePath of paths) {
      const icon = theme.iconFor(filePath);
      if (icon) icons[filePath] = icon;
    }
    return icons;
  }

  public fonts(): IconFont[] {
    return this.current()?.fonts() ?? [];
  }

  private current(): IconTheme | null {
    if (this.theme === undefined) {
      try {
        this.theme = this.load();
      } catch {
        this.theme = null; // Unreadable theme: the sidebar uses its own icons.
      }
    }
    return this.theme;
  }

  private load(): IconTheme | null {
    const id = vscode.workspace.getConfiguration('workbench').get<string | null>('iconTheme');
    if (!id) return null;
    for (const extension of vscode.extensions.all) {
      const themes = extension.packageJSON?.contributes?.iconThemes;
      const found = Array.isArray(themes) ? themes.find((t: any) => t?.id === id && typeof t.path === 'string') : undefined;
      if (!found) continue;

      const file = path.join(extension.extensionPath, found.path);
      const kind = vscode.window.activeColorTheme.kind;
      const variant =
        kind === vscode.ColorThemeKind.Light || kind === vscode.ColorThemeKind.HighContrastLight
          ? 'light'
          : kind === vscode.ColorThemeKind.HighContrast
          ? 'highContrast'
          : 'dark';
      const languages = vscode.extensions.all.flatMap((e) => {
        const list = e.packageJSON?.contributes?.languages;
        return Array.isArray(list) ? list : [];
      });
      return new IconTheme(
        JSON.parse(fs.readFileSync(file, 'utf8')),
        path.dirname(file),
        extension.extensionPath,
        buildLanguageMap(languages),
        variant
      );
    }
    return null;
  }
}
