import * as vscode from 'vscode';
import { StorageService } from './services/StorageService';
import { AIService } from './services/AIService';
import { AIProvider } from './services/aiClient';
import { CommitFlowPanel } from './providers/CommitFlowPanel';
import { SidebarViewProvider } from './providers/SidebarViewProvider';
import { REVISION_SCHEME, RevisionContentProvider } from './providers/RevisionContentProvider';

let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
  const storageService = new StorageService(context.workspaceState, context.globalState);
  const aiService = new AIService(context.secrets, () => {
    const config = vscode.workspace.getConfiguration('commitflow');
    return {
      enabled: config.get<boolean>('enableAI', false),
      provider: config.get<AIProvider>('aiProvider', 'openai'),
      model: config.get<string>('aiModel', ''),
      baseUrl: config.get<string>('aiBaseUrl', ''),
    };
  });

  // 1. Activity Bar Sidebar TreeView
  const sidebarProvider = new SidebarViewProvider(storageService);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('commitflow.sidebar', sidebarProvider)
  );

  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(
      REVISION_SCHEME,
      new RevisionContentProvider()
    )
  );

  // 2. Status Bar Item
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = 'commitflow.openDashboard';
  statusBarItem.text = '$(git-commit) CommitFlow';
  statusBarItem.tooltip = 'Open CommitFlow Visual Git History Dashboard';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Helper to open or reveal dashboard
  const openDashboard = () => {
    return CommitFlowPanel.createOrShow(context.extensionUri, storageService, aiService);
  };

  // 3. Register Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('commitflow.openDashboard', () => {
      openDashboard();
    }),

    vscode.commands.registerCommand('commitflow.refresh', () => {
      sidebarProvider.refresh();
      if (CommitFlowPanel.currentPanel) {
        CommitFlowPanel.currentPanel.messageHandler.handleMessage({ type: 'GET_REPOSITORIES' });
        CommitFlowPanel.currentPanel.messageHandler.handleMessage({
          type: 'GET_COMMITS',
          page: 1,
          pageSize: 30,
        });
      }
      vscode.window.showInformationMessage('CommitFlow repository refreshed.');
    }),

    vscode.commands.registerCommand('commitflow.search', () => {
      const panel = openDashboard();
      panel.postToWebview({ type: 'FOCUS_SEARCH' });
    }),

    vscode.commands.registerCommand('commitflow.clearFilters', () => {
      if (CommitFlowPanel.currentPanel) {
        CommitFlowPanel.currentPanel.messageHandler.handleMessage({
          type: 'GET_COMMITS',
          page: 1,
          pageSize: 30,
        });
      }
    }),

    vscode.commands.registerCommand('commitflow.openCommit', (hash?: string) => {
      const panel = openDashboard();
      if (hash) {
        panel.postToWebview({ type: 'OPEN_COMMIT', hash });
      }
    }),

    vscode.commands.registerCommand('commitflow.compareCommits', () => {
      const panel = openDashboard();
      panel.postToWebview({ type: 'SWITCH_VIEW', view: 'compare' });
    }),

    vscode.commands.registerCommand('commitflow.openFileHistory', (uri?: vscode.Uri) => {
      const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
      const panel = openDashboard();
      if (targetUri?.scheme === 'file') {
        panel.postToWebview({ type: 'OPEN_FILE_HISTORY', filePath: targetUri.fsPath });
      } else {
        panel.postToWebview({ type: 'SWITCH_VIEW', view: 'fileHistory' });
      }
    }),

    vscode.commands.registerCommand('commitflow.viewBranches', () => {
      const panel = openDashboard();
      panel.postToWebview({ type: 'SWITCH_VIEW', view: 'branches' });
    }),

    vscode.commands.registerCommand('commitflow.viewAnalytics', () => {
      const panel = openDashboard();
      panel.postToWebview({ type: 'SWITCH_VIEW', view: 'analytics' });
    }),

    vscode.commands.registerCommand('commitflow.checkoutCommit', async (hash?: string) => {
      let target = hash;
      if (!target) {
        target = await vscode.window.showInputBox({
          prompt: 'Enter commit SHA, branch or tag to checkout',
          placeHolder: 'e.g. main, v1.0.0, a82f91c',
        });
      }
      if (!target) return;

      const confirm = await vscode.window.showWarningMessage(
        `Are you sure you want to checkout '${target}'? Make sure your work is saved.`,
        { modal: true },
        'Checkout'
      );
      if (confirm === 'Checkout') {
        const panel = openDashboard();
        await panel.messageHandler.handleMessage({
          type: 'EXECUTE_GIT_OP',
          operation: 'checkout',
          params: { target },
        });
      }
    }),

    vscode.commands.registerCommand('commitflow.cherryPick', async (hash?: string) => {
      let target = hash;
      if (!target) {
        target = await vscode.window.showInputBox({
          prompt: 'Enter commit SHA to cherry-pick',
          placeHolder: 'e.g. a82f91c',
        });
      }
      if (!target) return;

      const panel = openDashboard();
      await panel.messageHandler.handleMessage({
        type: 'EXECUTE_GIT_OP',
        operation: 'cherry-pick',
        params: { hash: target },
      });
    }),

    vscode.commands.registerCommand('commitflow.revertCommit', async (hash?: string) => {
      let target = hash;
      if (!target) {
        target = await vscode.window.showInputBox({
          prompt: 'Enter commit SHA to revert',
          placeHolder: 'e.g. a82f91c',
        });
      }
      if (!target) return;

      const confirm = await vscode.window.showWarningMessage(
        `Reverting commit '${target}' will create a new commit reversing the changes. Continue?`,
        { modal: true },
        'Revert Commit'
      );
      if (confirm === 'Revert Commit') {
        const panel = openDashboard();
        await panel.messageHandler.handleMessage({
          type: 'EXECUTE_GIT_OP',
          operation: 'revert',
          params: { hash: target },
        });
      }
    }),

    vscode.commands.registerCommand('commitflow.createBranch', async (startPoint?: string) => {
      const name = await vscode.window.showInputBox({
        prompt: 'Enter new branch name',
        placeHolder: 'feature/new-feature',
      });
      if (!name) return;

      const panel = openDashboard();
      await panel.messageHandler.handleMessage({
        type: 'EXECUTE_GIT_OP',
        operation: 'create-branch',
        params: { name, startPoint: startPoint || 'HEAD' },
      });
    }),

    vscode.commands.registerCommand('commitflow.createTag', async (targetHash?: string) => {
      const name = await vscode.window.showInputBox({
        prompt: 'Enter tag name',
        placeHolder: 'v1.0.0',
      });
      if (!name) return;

      const message = await vscode.window.showInputBox({
        prompt: 'Optional tag message (leave blank for lightweight tag)',
        placeHolder: 'Release version 1.0.0',
      });

      const panel = openDashboard();
      await panel.messageHandler.handleMessage({
        type: 'EXECUTE_GIT_OP',
        operation: 'create-tag',
        params: { name, targetHash: targetHash || 'HEAD', message },
      });
    }),

    vscode.commands.registerCommand('commitflow.configureAI', () => {
      openDashboard().postToWebview({ type: 'SWITCH_VIEW', view: 'settings' });
    }),

    vscode.commands.registerCommand('commitflow.openSettings', () => {
      vscode.commands.executeCommand('workbench.action.openSettings', 'commitflow');
    })
  );
}

export function deactivate() {
  if (statusBarItem) {
    statusBarItem.dispose();
  }
}

