import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { MessageHandler } from '../webview/MessageHandler';
import { StorageService } from '../services/StorageService';
import { AIService } from '../services/AIService';
import { Security } from '../webview/Security';

export class CommitFlowPanel {
  public static currentPanel: CommitFlowPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private disposables: vscode.Disposable[] = [];
  public readonly messageHandler: MessageHandler;

  public static createOrShow(
    extensionUri: vscode.Uri,
    storageService: StorageService,
    aiService: AIService
  ): CommitFlowPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (CommitFlowPanel.currentPanel) {
      CommitFlowPanel.currentPanel.panel.reveal(column);
      return CommitFlowPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      'commitflow.dashboard',
      'CommitFlow',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          extensionUri,
          vscode.Uri.joinPath(extensionUri, 'dist'),
          vscode.Uri.joinPath(extensionUri, 'dist', 'webview'),
          vscode.Uri.joinPath(extensionUri, 'media'),
        ],
      }
    );

    CommitFlowPanel.currentPanel = new CommitFlowPanel(
      panel,
      extensionUri,
      storageService,
      aiService
    );
    return CommitFlowPanel.currentPanel;
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    storageService: StorageService,
    aiService: AIService
  ) {
    this.panel = panel;
    this.extensionUri = extensionUri;

    this.messageHandler = new MessageHandler(panel, storageService, aiService);

    // Set panel icon
    this.panel.iconPath = {
      light: vscode.Uri.joinPath(extensionUri, 'media', 'activitybar-icon.svg'),
      dark: vscode.Uri.joinPath(extensionUri, 'media', 'activitybar-icon.svg'),
    };

    // Set HTML content
    this.updateWebview();

    // Listen for messages from the webview
    this.panel.webview.onDidReceiveMessage(
      (message) => this.messageHandler.handleMessage(message),
      null,
      this.disposables
    );

    // Handle disposal
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  public reveal(): void {
    this.panel.reveal();
  }

  private updateWebview(): void {
    const webview = this.panel.webview;
    const nonce = Security.getNonce();
    const csp = Security.getCSP(webview.cspSource, nonce);

    const distPath = path.join(this.extensionUri.fsPath, 'dist', 'webview');
    const indexHtmlPath = path.join(distPath, 'index.html');

    if (fs.existsSync(indexHtmlPath)) {
      let html = fs.readFileSync(indexHtmlPath, 'utf8');

      // Replace asset paths (matching /assets/..., ./assets/..., or assets/...) with webview URIs
      html = html.replace(/(href|src)="(\.\/|\/)?(assets\/[^"]+)"/g, (_match, attr, _prefix, assetPath) => {
        const uri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', assetPath));
        return `${attr}="${uri}"`;
      });

      // Add nonce to script tags
      html = html.replace(/<script /g, `<script nonce="${nonce}" `);

      // Remove crossorigin attribute if present to avoid CORS restriction on vscode-resource
      html = html.replace(/crossorigin/g, '');

      // Inject strict CSP
      html = html.replace(
        '<head>',
        `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}">`
      );

      this.panel.webview.html = html;
    } else {
      this.panel.webview.html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta http-equiv="Content-Security-Policy" content="${csp}">
          <title>CommitFlow</title>
          <style>
            body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; color: #888; }
          </style>
        </head>
        <body>
          <div>
            <h2>CommitFlow Webview is building...</h2>
            <p>Please run npm run build in the project root.</p>
          </div>
        </body>
        </html>
      `;
    }
  }

  public dispose(): void {
    CommitFlowPanel.currentPanel = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      const d = this.disposables.pop();
      if (d) d.dispose();
    }
  }
}
