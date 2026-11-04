import * as vscode from 'vscode';
import * as path from 'path';
import { ExtensionMessage, WebviewMessage } from '../types/protocol';
import { GitRepository } from '../git/GitRepository';
import { CommitService } from '../git/CommitService';
import { BranchService } from '../git/BranchService';
import { TagService } from '../git/TagService';
import { DiffService } from '../git/DiffService';
import { FileHistoryService } from '../git/FileHistoryService';
import { FileContentService, WORKING_COPY_REF } from '../git/FileContentService';
import { RevisionContentProvider } from '../providers/RevisionContentProvider';
import { AnalyticsService } from '../services/AnalyticsService';
import { SearchService } from '../services/SearchService';
import { StorageService } from '../services/StorageService';
import { AIService } from '../services/AIService';
import { RepositoryInfo } from '../types/git';

export class MessageHandler {
  private activeRepo: RepositoryInfo | null = null;
  private repositories: RepositoryInfo[] = [];

  constructor(
    private readonly panel: vscode.WebviewPanel,
    private readonly storageService: StorageService,
    private readonly aiService: AIService
  ) {}

  public getActiveRepository(): RepositoryInfo | null {
    return this.activeRepo;
  }

  public setActiveRepository(repo: RepositoryInfo | null): void {
    this.activeRepo = repo;
  }

  public async handleMessage(message: WebviewMessage): Promise<void> {
    const requestId = message.id;

    try {
      switch (message.type) {
        case 'GET_REPOSITORIES': {
          await this.refreshRepositories();
          this.postMessage({
            type: 'REPOSITORIES_LOADED',
            repositories: this.repositories,
            activeRepo: this.activeRepo,
            requestId,
          });
          break;
        }

        case 'SELECT_REPOSITORY': {
          const found = this.repositories.find((r) => r.rootUri === message.repoPath);
          if (found) {
            this.activeRepo = found;
            await this.storageService.setLastRepository(found.rootUri);
            this.postMessage({
              type: 'REPOSITORIES_LOADED',
              repositories: this.repositories,
              activeRepo: this.activeRepo,
              requestId,
            });
          }
          break;
        }

        case 'GET_COMMITS': {
          if (!this.activeRepo) {
            await this.refreshRepositories();
          }
          if (!this.activeRepo) {
            this.postMessage({
              type: 'COMMITS_LOADED',
              commits: [],
              totalCount: 0,
              page: 1,
              hasMore: false,
              requestId,
            });
            return;
          }

          const res = await CommitService.getCommits(this.activeRepo.rootUri, {
            page: message.page,
            pageSize: message.pageSize,
            filters: message.filters,
            branch: message.branch,
          });

          this.postMessage({
            type: 'COMMITS_LOADED',
            commits: res.commits,
            totalCount: res.totalCount,
            page: message.page,
            hasMore: res.hasMore,
            activeBranch: this.activeRepo.currentBranch,
            requestId,
          });
          break;
        }

        case 'SEARCH_COMMITS': {
          if (!this.activeRepo) {
            await this.refreshRepositories();
          }
          if (!this.activeRepo) return;

          const parsed = SearchService.parseQuery(message.query);
          const res = await CommitService.getCommits(this.activeRepo.rootUri, {
            page: message.page,
            pageSize: message.pageSize,
            filters: parsed.filters,
            searchQuery: parsed.freeText,
          });

          this.postMessage({
            type: 'SEARCH_RESULTS',
            commits: res.commits,
            totalCount: res.totalCount,
            page: message.page,
            hasMore: res.hasMore,
            requestId,
          });
          break;
        }

        case 'GET_COMMIT_DETAILS': {
          if (!this.activeRepo) return;
          const details = await CommitService.getCommitDetails(this.activeRepo.rootUri, message.hash);
          this.postMessage({
            type: 'COMMIT_DETAILS_LOADED',
            details,
            requestId,
          });
          break;
        }

        case 'GET_COMMIT_DIFF': {
          if (!this.activeRepo) return;
          const diff = await CommitService.getFileDiff(
            this.activeRepo.rootUri,
            message.hash,
            message.filePath
          );
          this.postMessage({
            type: 'DIFF_LOADED',
            hash: message.hash,
            diff,
            filePath: message.filePath,
            requestId,
          });
          break;
        }

        case 'COMPARE_COMMITS': {
          if (!this.activeRepo) return;
          const result = await DiffService.compareCommits(
            this.activeRepo.rootUri,
            message.baseHash,
            message.targetHash
          );
          this.postMessage({
            type: 'COMPARE_RESULT_LOADED',
            result,
            requestId,
          });
          break;
        }

        case 'GET_BRANCHES_TAGS': {
          if (!this.activeRepo) return;
          const branches = await BranchService.getBranches(this.activeRepo.rootUri);
          const tags = await TagService.getTags(this.activeRepo.rootUri);
          this.postMessage({
            type: 'BRANCHES_TAGS_LOADED',
            branches,
            tags,
            requestId,
          });
          break;
        }

        case 'GET_ANALYTICS': {
          if (!this.activeRepo) return;
          const analytics = await AnalyticsService.getAnalytics(this.activeRepo.rootUri);
          this.postMessage({
            type: 'ANALYTICS_LOADED',
            analytics,
            requestId,
          });
          break;
        }

        case 'GET_FILE_HISTORY': {
          const target = await this.resolveFile(message.filePath);
          const history = await FileHistoryService.getFileHistory(
            target.repoRoot,
            target.filePath,
            message.offset,
            message.limit
          );
          this.postMessage({
            type: 'FILE_HISTORY_LOADED',
            filePath: target.filePath,
            ...history,
            requestId,
          });
          break;
        }

        case 'GET_FILE_CONTENT': {
          const target = await this.resolveFile(message.filePath);
          const file = await FileContentService.getContent(
            target.repoRoot,
            message.ref,
            target.filePath
          );
          this.postMessage({ type: 'FILE_CONTENT_LOADED', ...file, requestId });
          break;
        }

        case 'GET_TRACKED_FILES': {
          const repo = await this.requireActiveRepo();
          const files = await FileContentService.listTrackedFiles(repo.rootUri);
          this.postMessage({ type: 'TRACKED_FILES_LOADED', files, requestId });
          break;
        }

        case 'EXECUTE_GIT_OP': {
          if (!this.activeRepo) return;
          await this.handleGitOperation(message.operation, message.params, requestId);
          break;
        }

        case 'GET_SAVED_FILTERS': {
          const filters = this.storageService.getSavedFilters();
          this.postMessage({
            type: 'SAVED_FILTERS_LOADED',
            filters,
            requestId,
          });
          break;
        }

        case 'SAVE_FILTER': {
          const filters = await this.storageService.saveFilter(message.filter);
          this.postMessage({
            type: 'SAVED_FILTERS_LOADED',
            filters,
            requestId,
          });
          break;
        }

        case 'DELETE_SAVED_FILTER': {
          const filters = await this.storageService.deleteFilter(message.id);
          this.postMessage({
            type: 'SAVED_FILTERS_LOADED',
            filters,
            requestId,
          });
          break;
        }

        case 'GET_SETTINGS': {
          const config = vscode.workspace.getConfiguration('commitflow');
          this.postMessage({
            type: 'SETTINGS_LOADED',
            settings: {
              pageSize: config.get('pageSize', 30),
              defaultViewMode: config.get('defaultViewMode', 'grid'),
              dateFormat: config.get('dateFormat', 'relative'),
              enableAI: config.get('enableAI', false),
              aiProvider: config.get('aiProvider', 'openai'),
            },
            requestId,
          });
          break;
        }

        case 'UPDATE_SETTINGS': {
          const config = vscode.workspace.getConfiguration('commitflow');
          for (const [key, val] of Object.entries(message.settings)) {
            await config.update(key, val, vscode.ConfigurationTarget.Global);
          }
          break;
        }

        case 'AI_ACTION': {
          if (!this.activeRepo) return;
          await this.handleAIAction(message.action, message.payload, requestId);
          break;
        }

        case 'COPY_TO_CLIPBOARD': {
          await vscode.env.clipboard.writeText(message.text);
          vscode.window.showInformationMessage('Copied to clipboard');
          break;
        }

        case 'OPEN_IN_EDITOR': {
          if (!this.activeRepo) return;
          const fullPath = path.isAbsolute(message.filePath)
            ? message.filePath
            : path.join(this.activeRepo.rootUri, message.filePath);
          const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(fullPath));
          await vscode.window.showTextDocument(doc, {
            preview: true,
            selection: message.line
              ? new vscode.Range(message.line - 1, 0, message.line - 1, 0)
              : undefined,
          });
          break;
        }

        case 'OPEN_DIFF_EDITOR': {
          const { repoRoot, filePath } = await this.resolveFile(message.filePath);
          const { baseHash, targetHash, basePath } = message;
          const label = (ref: string | null) =>
            ref === null
              ? 'none'
              : ref === WORKING_COPY_REF
              ? 'Working Copy'
              : /^[0-9a-f]{40}$/.test(ref)
              ? ref.substring(0, 7)
              : ref;

          await vscode.commands.executeCommand(
            'vscode.diff',
            RevisionContentProvider.toUri(repoRoot, baseHash, basePath ?? filePath),
            targetHash === WORKING_COPY_REF
              ? vscode.Uri.file(path.join(repoRoot, filePath))
              : RevisionContentProvider.toUri(repoRoot, targetHash, filePath),
            `${path.basename(filePath)} (${label(baseHash)} ↔ ${label(targetHash)})`
          );
          break;
        }
      }
    } catch (err: any) {
      this.postMessage({
        type: 'ERROR',
        message: err.message || 'An unexpected error occurred in CommitFlow.',
        requestId,
      });
    }
  }

  private async requireActiveRepo(): Promise<RepositoryInfo> {
    if (!this.activeRepo) {
      await this.refreshRepositories();
    }
    if (!this.activeRepo) {
      throw new Error('No Git repository found in this workspace.');
    }
    return this.activeRepo;
  }

  /**
   * Resolve a file to a repository and repo-relative path. An absolute path may
   * belong to a repository other than the active one, which then becomes active.
   */
  private async resolveFile(filePath: string): Promise<{ repoRoot: string; filePath: string }> {
    const active = await this.requireActiveRepo();
    if (!path.isAbsolute(filePath)) {
      return { repoRoot: active.rootUri, filePath: filePath.replace(/\\/g, '/') };
    }

    const isInside = (root: string) => {
      const relative = path.relative(root, filePath);
      return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
    };
    const owner = this.repositories
      .filter((repo) => isInside(repo.rootUri))
      .sort((a, b) => b.rootUri.length - a.rootUri.length)[0];
    if (!owner) {
      throw new Error(`${path.basename(filePath)} is not inside a Git repository in this workspace.`);
    }

    if (owner.rootUri !== active.rootUri) {
      this.activeRepo = owner;
      await this.storageService.setLastRepository(owner.rootUri);
      this.postMessage({
        type: 'REPOSITORIES_LOADED',
        repositories: this.repositories,
        activeRepo: owner,
      });
    }

    return {
      repoRoot: owner.rootUri,
      filePath: path.relative(owner.rootUri, filePath).split(path.sep).join('/'),
    };
  }

  private async refreshRepositories(): Promise<void> {
    const folders = vscode.workspace.workspaceFolders?.map((f) => f.uri.fsPath) || [];
    this.repositories = await GitRepository.discoverRepositories(folders);

    if (this.repositories.length > 0) {
      const last = this.storageService.getLastRepository();
      const matched = this.repositories.find((r) => r.rootUri === last);
      this.activeRepo = matched || this.repositories[0];
    } else {
      this.activeRepo = null;
    }
  }

  private async handleGitOperation(
    op: string,
    params: Record<string, any>,
    requestId?: string
  ): Promise<void> {
    if (!this.activeRepo) return;
    const repo = this.activeRepo.rootUri;

    try {
      switch (op) {
        case 'checkout': {
          await BranchService.checkout(repo, params.target);
          await this.refreshRepositories();
          this.postMessage({
            type: 'GIT_OP_SUCCESS',
            operation: op,
            message: `Successfully checked out ${params.target}`,
            requestId,
          });
          break;
        }
        case 'create-branch': {
          await BranchService.createBranch(repo, params.name, params.startPoint);
          await this.refreshRepositories();
          this.postMessage({
            type: 'GIT_OP_SUCCESS',
            operation: op,
            message: `Created and switched to branch '${params.name}'`,
            requestId,
          });
          break;
        }
        case 'delete-branch': {
          await BranchService.deleteBranch(repo, params.name, params.force);
          this.postMessage({
            type: 'GIT_OP_SUCCESS',
            operation: op,
            message: `Deleted branch '${params.name}'`,
            requestId,
          });
          break;
        }
        case 'cherry-pick': {
          await DiffService.cherryPick(repo, params.hash);
          this.postMessage({
            type: 'GIT_OP_SUCCESS',
            operation: op,
            message: `Cherry-picked commit ${params.hash.substring(0, 7)} successfully`,
            requestId,
          });
          break;
        }
        case 'revert': {
          await DiffService.revert(repo, params.hash, params.isMerge);
          this.postMessage({
            type: 'GIT_OP_SUCCESS',
            operation: op,
            message: `Reverted commit ${params.hash.substring(0, 7)} successfully`,
            requestId,
          });
          break;
        }
        case 'create-tag': {
          await TagService.createTag(repo, params.name, params.targetHash, params.message);
          this.postMessage({
            type: 'GIT_OP_SUCCESS',
            operation: op,
            message: `Tag '${params.name}' created successfully`,
            requestId,
          });
          break;
        }
      }
    } catch (err: any) {
      this.postMessage({
        type: 'GIT_OP_ERROR',
        operation: op,
        error: err.message || `Failed to execute ${op}`,
        requestId,
      });
    }
  }

  private async handleAIAction(action: string, payload: any, requestId?: string): Promise<void> {
    try {
      switch (action) {
        case 'summarize': {
          const result = await this.aiService.summarizeCommit(payload.commit);
          this.postMessage({ type: 'AI_RESULT', action, result, requestId });
          break;
        }
        case 'nl_search': {
          const query = await this.aiService.translateNaturalLanguageSearch(payload.prompt);
          this.postMessage({ type: 'AI_RESULT', action, result: { query }, requestId });
          break;
        }
        case 'release_notes': {
          const notes = await this.aiService.generateReleaseNotes(
            payload.commits,
            payload.baseRef,
            payload.targetRef
          );
          this.postMessage({ type: 'AI_RESULT', action, result: { notes }, requestId });
          break;
        }
      }
    } catch (err: any) {
      this.postMessage({
        type: 'ERROR',
        message: `AI action failed: ${err.message}`,
        requestId,
      });
    }
  }

  private postMessage(msg: ExtensionMessage): void {
    this.panel.webview.postMessage(msg);
  }
}

