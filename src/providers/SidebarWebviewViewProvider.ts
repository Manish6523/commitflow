import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { StorageService } from '../services/StorageService';
import { AIService } from '../services/AIService';
import { Security } from '../webview/Security';
import { ExtensionMessage, ScmAction, ScmFileGroup, WebviewMessage } from '../types/protocol';
import { WorkingFileChange } from '../types/git';
import { ScmController } from './ScmController';

// File saves and git commands come in bursts, so wait for a quiet moment.
const REFRESH_DELAY_MS = 300;
// Opening dozens of diff tabs at once is never what someone meant.
const MAX_FILES_TO_OPEN = 10;

/** What a right-click on a file row passes to a context menu command. */
export interface FileMenuContext {
  group: ScmFileGroup;
  files: WorkingFileChange[];
}

export type FileCommand = 'openChanges' | 'openFile' | 'stage' | 'unstage' | 'discard' | 'fileHistory' | 'copyPath' | 'reveal';

/** The CommitFlow activity bar view: a Source Control panel with a commit graph. */
export class SidebarWebviewViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  public static readonly viewType = 'commitflow.sidebar';

  private view?: vscode.WebviewView;
  private readonly controller: ScmController;
  private readonly disposables: vscode.Disposable[] = [];
  private refreshTimer?: NodeJS.Timeout;
  private refreshing = false;
  private refreshAgain = false;

  constructor(
    private readonly extensionUri: vscode.Uri,
    storageService: StorageService,
    aiService: AIService,
    onHistoryChanged: () => void
  ) {
    this.controller = new ScmController(storageService, aiService, onHistoryChanged);
    const stopListening = storageService.onStarsChanged(() => this.refresh());

    const watcher = vscode.workspace.createFileSystemWatcher('**/*');
    const schedule = () => this.scheduleRefresh();
    this.disposables.push(
      { dispose: stopListening },
      watcher,
      watcher.onDidChange(schedule),
      watcher.onDidCreate(schedule),
      watcher.onDidDelete(schedule),
      // Changes made outside VS Code, such as in another terminal, show up on return.
      vscode.window.onDidChangeWindowState((state) => state.focused && schedule()),
      vscode.workspace.onDidChangeWorkspaceFolders(async () => {
        await this.controller.discover();
        schedule();
      })
    );
  }

  public dispose(): void {
    clearTimeout(this.refreshTimer);
    this.disposables.forEach((d) => d.dispose());
  }

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview')],
    };
    webviewView.webview.html = this.getHtml(webviewView.webview);

    this.disposables.push(
      webviewView.webview.onDidReceiveMessage((message: WebviewMessage) => this.handleMessage(message)),
      webviewView.onDidChangeVisibility(() => webviewView.visible && this.scheduleRefresh())
    );
  }

  /** Reload the working tree and history, now. */
  public async refresh(): Promise<void> {
    if (this.refreshing) {
      this.refreshAgain = true;
      return;
    }
    this.refreshing = true;
    try {
      const state = await this.controller.getState();
      this.post({ type: 'SCM_STATE', state });
      if (this.view) {
        const count = ScmController.countChanges(state);
        this.view.badge = count ? { value: count, tooltip: `${count} pending change${count === 1 ? '' : 's'}` } : undefined;
        const status = state.status;
        this.view.description = status ? status.branch ?? (status.head ? `detached at ${status.head}` : undefined) : undefined;
      }
    } catch {
      // A repository being rewritten mid-refresh can fail one read; the next event retries.
    } finally {
      this.refreshing = false;
      if (this.refreshAgain) {
        this.refreshAgain = false;
        this.scheduleRefresh();
      }
    }
  }

  /** Run an action from a command, such as the view's title bar menu. */
  public async runAction(action: ScmAction): Promise<void> {
    try {
      await this.perform(action);
    } catch (err: any) {
      vscode.window.showErrorMessage(err.message);
    }
  }

  /** Run a command from a file row's right-click menu. */
  public async runFileCommand(command: FileCommand, context?: FileMenuContext): Promise<void> {
    const root = this.controller.root;
    const files = context?.files ?? [];
    if (!root || !files.length) return;
    const paths = files.map((f) => f.path);

    switch (command) {
      case 'openChanges':
      case 'openFile':
        for (const file of files.slice(0, MAX_FILES_TO_OPEN)) {
          await this.controller.open(file, context!.group, command === 'openChanges' ? 'diff' : 'file');
        }
        return;
      case 'stage':
        return this.runAction({ kind: 'stage', paths });
      case 'unstage':
        return this.runAction({ kind: 'unstage', paths });
      case 'discard':
        return this.runAction({ kind: 'discard', changes: files });
      case 'fileHistory':
        await vscode.commands.executeCommand('commitflow.openFileHistory', vscode.Uri.file(path.join(root, paths[0])));
        return;
      case 'copyPath':
        await vscode.env.clipboard.writeText(paths.join('\n'));
        return;
      case 'reveal':
        await vscode.commands.executeCommand('revealInExplorer', vscode.Uri.file(path.join(root, paths[0])));
        return;
    }
  }

  /** The commit open in the dashboard, which the graph highlights. */
  private openCommit: string | null = null;

  public setOpenCommit(hash: string | null): void {
    this.openCommit = hash;
    this.post({ type: 'SCM_OPEN_COMMIT', hash });
  }

  private scheduleRefresh(): void {
    clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => this.refresh(), REFRESH_DELAY_MS);
  }

  private async perform(action: ScmAction) {
    try {
      const result = await vscode.window.withProgress(
        { location: { viewId: SidebarWebviewViewProvider.viewType } },
        () => this.controller.run(action)
      );
      if (result?.message) vscode.window.setStatusBarMessage(`$(check) ${result.message}`, 4000);
      return result;
    } finally {
      await this.refresh();
    }
  }

  private async handleMessage(message: WebviewMessage): Promise<void> {
    const requestId = message.id;
    try {
      switch (message.type) {
        case 'WEBVIEW_READY':
        case 'SCM_GET_STATE':
          await this.refresh();
          this.post({ type: 'SCM_OPEN_COMMIT', hash: this.openCommit });
          break;

        case 'SCM_SELECT_REPOSITORY':
          await this.controller.selectRepository(message.root);
          await this.refresh();
          break;

        case 'SCM_ACTION': {
          const result = await this.perform(message.action);
          this.post({ type: 'SCM_ACTION_DONE', ...result, requestId });
          break;
        }

        case 'SCM_OPEN':
          await this.controller.open(message.file, message.group, message.mode);
          break;

        case 'SCM_GENERATE_MESSAGE': {
          const result = await vscode.window.withProgress(
            { location: { viewId: SidebarWebviewViewProvider.viewType } },
            () => this.controller.generateCommitMessage()
          );
          if (result.warning) vscode.window.showWarningMessage(result.warning);
          this.post({ type: 'COMMIT_MESSAGE_GENERATED', ...result, requestId });
          break;
        }

        case 'SCM_COMMIT_FILES': {
          const files = await this.controller.getCommitFiles(message.hash);
          this.post({ type: 'SCM_COMMIT_FILES_LOADED', hash: message.hash, files, requestId });
          break;
        }

        case 'TOGGLE_STAR':
          await this.controller.toggleStar(message.hash);
          break;

        case 'SCM_OPEN_COMMIT_FILE':
          await this.controller.openCommitFile(message.hash, message.parent, message.file);
          break;

        case 'SCM_FILE_HISTORY': {
          const root = this.controller.root;
          if (root) {
            await vscode.commands.executeCommand('commitflow.openFileHistory', vscode.Uri.file(path.join(root, message.path)));
          }
          break;
        }

        case 'OPEN_DASHBOARD':
          await vscode.commands.executeCommand(message.hash ? 'commitflow.openCommit' : 'commitflow.openDashboard', message.hash);
          break;
      }
    } catch (err: any) {
      if (message.type === 'SCM_ACTION' || message.type === 'SCM_GENERATE_MESSAGE') {
        vscode.window.showErrorMessage(err.message);
      }
      this.post({ type: 'ERROR', message: err.message ?? 'Something went wrong.', requestId });
    }
  }

  private post(message: ExtensionMessage): void {
    this.view?.webview.postMessage(message);
  }

  private getHtml(webview: vscode.Webview): string {
    const distPath = path.join(this.extensionUri.fsPath, 'dist', 'webview');
    const indexHtmlPath = path.join(distPath, 'index.html');
    if (!fs.existsSync(indexHtmlPath)) {
      return '<!DOCTYPE html><html><body>CommitFlow’s interface is missing. Run npm run build.</body></html>';
    }

    const nonce = Security.getNonce();
    const csp = Security.getCSP(webview.cspSource, nonce);
    return fs
      .readFileSync(indexHtmlPath, 'utf8')
      .replace(/(href|src)="(\.\/|\/)?(assets\/[^"]+)"/g, (_match, attr, _prefix, assetPath) => {
        const uri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', assetPath));
        return `${attr}="${uri}"`;
      })
      .replace(/<script /g, `<script nonce="${nonce}" `)
      .replace(/crossorigin/g, '')
      .replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}">`)
      .replace(/<body([^>]*)>/, '<body$1 data-view="sidebar">');
  }
}
