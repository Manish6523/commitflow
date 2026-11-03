import * as vscode from 'vscode';
import { StorageService } from '../services/StorageService';
import { GitRepository } from '../git/GitRepository';
import { CommitService } from '../git/CommitService';
import { GitCommit } from '../types/git';

export class SidebarItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly contextValue?: string,
    public readonly command?: vscode.Command,
    public readonly iconPath?: vscode.ThemeIcon
  ) {
    super(label, collapsibleState);
  }
}

export class SidebarViewProvider implements vscode.TreeDataProvider<SidebarItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<SidebarItem | undefined | null | void> =
    new vscode.EventEmitter<SidebarItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<SidebarItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  private recentCommits: GitCommit[] = [];
  private activeRepoName = 'No repository';
  private activeRepoRoot: string | null = null;

  constructor(private readonly storageService: StorageService) {
    this.refresh();
  }

  public async refresh(): Promise<void> {
    const folders = vscode.workspace.workspaceFolders?.map((f) => f.uri.fsPath) || [];
    const repos = await GitRepository.discoverRepositories(folders);

    if (repos.length > 0) {
      const active = repos[0];
      this.activeRepoName = active.name;
      this.activeRepoRoot = active.rootUri;
      try {
        const res = await CommitService.getCommits(active.rootUri, { pageSize: 5 });
        this.recentCommits = res.commits;
      } catch {
        this.recentCommits = [];
      }
    } else {
      this.activeRepoName = 'No repository found';
      this.activeRepoRoot = null;
      this.recentCommits = [];
    }

    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: SidebarItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: SidebarItem): Promise<SidebarItem[]> {
    if (!element) {
      // Root level items
      return [
        new SidebarItem(
          `Repo: ${this.activeRepoName}`,
          vscode.TreeItemCollapsibleState.None,
          'repo',
          undefined,
          new vscode.ThemeIcon('repo')
        ),
        new SidebarItem(
          'Open CommitFlow Dashboard',
          vscode.TreeItemCollapsibleState.None,
          'open-dashboard',
          {
            command: 'commitflow.openDashboard',
            title: 'Open Dashboard',
          },
          new vscode.ThemeIcon('dashboard')
        ),
        new SidebarItem(
          'Saved Filters',
          vscode.TreeItemCollapsibleState.Collapsed,
          'saved-filters-group',
          undefined,
          new vscode.ThemeIcon('filter')
        ),
        new SidebarItem(
          'Recent Commits',
          vscode.TreeItemCollapsibleState.Expanded,
          'recent-commits-group',
          undefined,
          new vscode.ThemeIcon('history')
        ),
      ];
    }

    if (element.contextValue === 'saved-filters-group') {
      const filters = this.storageService.getSavedFilters();
      return filters.map(
        (f) =>
          new SidebarItem(
            f.name,
            vscode.TreeItemCollapsibleState.None,
            'filter-item',
            {
              command: 'commitflow.openDashboard',
              title: 'Open with filter',
            },
            new vscode.ThemeIcon('bookmark')
          )
      );
    }

    if (element.contextValue === 'recent-commits-group') {
      if (this.recentCommits.length === 0) {
        return [
          new SidebarItem(
            'No commits yet',
            vscode.TreeItemCollapsibleState.None,
            'empty',
            undefined,
            new vscode.ThemeIcon('info')
          ),
        ];
      }
      return this.recentCommits.map(
        (c) =>
          new SidebarItem(
            `${c.shortHash} ${c.subject}`,
            vscode.TreeItemCollapsibleState.None,
            'commit-item',
            {
              command: 'commitflow.openCommit',
              title: 'View Commit',
              arguments: [c.hash],
            },
            new vscode.ThemeIcon('git-commit')
          )
      );
    }

    return [];
  }
}
