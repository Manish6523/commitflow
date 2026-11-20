import * as vscode from 'vscode';
import * as path from 'path';
import { GitRepository } from '../git/GitRepository';
import { CommitService } from '../git/CommitService';
import { BranchService } from '../git/BranchService';
import { GitProcess } from '../git/GitProcess';
import { SourceControlService, describeGitError } from '../git/SourceControlService';
import { StorageService } from '../services/StorageService';
import { AIService } from '../services/AIService';
import { RevisionContentProvider } from './RevisionContentProvider';
import { RepositoryInfo, WorkingFileChange } from '../types/git';
import { ScmAction, ScmFileGroup, ScmState } from '../types/protocol';

// The graph starts with this many commits and grows as you scroll.
const GRAPH_FIRST_PAGE = 50;
const GRAPH_PAGE = 100;

/** Runs the Source Control sidebar: reads the working tree and carries out actions on it. */
export class ScmController {
  private repositories: RepositoryInfo[] = [];
  private activeRoot: string | null = null;
  private graphLimit = GRAPH_FIRST_PAGE;

  constructor(
    private readonly storageService: StorageService,
    private readonly aiService: AIService,
    /** Called after anything that changes history, so other views can refresh. */
    private readonly onHistoryChanged: () => void
  ) {}

  public get root(): string | null {
    return this.activeRoot;
  }

  public async discover(): Promise<void> {
    const folders = vscode.workspace.workspaceFolders?.map((f) => f.uri.fsPath) ?? [];
    this.repositories = await GitRepository.discoverRepositories(folders);
    const roots = this.repositories.map((r) => r.rootUri);
    if (!this.activeRoot || !roots.includes(this.activeRoot)) {
      const last = this.storageService.getLastRepository();
      this.activeRoot = roots.find((r) => r === last) ?? roots[0] ?? null;
    }
  }

  public async selectRepository(root: string): Promise<void> {
    if (!this.repositories.some((r) => r.rootUri === root)) return;
    this.activeRoot = root;
    this.graphLimit = GRAPH_FIRST_PAGE;
    await this.storageService.setLastRepository(root);
  }

  public async getState(): Promise<ScmState> {
    if (!this.repositories.length) await this.discover();
    const repositories = this.repositories.map((r) => ({ name: r.name, root: r.rootUri }));
    const root = this.activeRoot;
    if (!root) return { repositories, activeRoot: null, status: null, stashes: [], commits: [], commitsHasMore: false, starred: [] };

    const [status, stashes] = await Promise.all([SourceControlService.getStatus(root), SourceControlService.getStashes(root)]);
    const graph = await this.getGraphCommits(root, status.head !== null, status.upstream !== null).catch(() => ({
      commits: [],
      hasMore: false,
    }));
    return {
      repositories,
      activeRoot: root,
      status,
      stashes,
      commits: graph.commits,
      commitsHasMore: graph.hasMore,
      starred: this.storageService.getStarred(root),
    };
  }

  /** Recent commits on this branch and, like VS Code's graph, the ones coming in from its upstream. */
  private async getGraphCommits(root: string, hasHead: boolean, hasUpstream: boolean) {
    if (!hasHead) return { commits: [], hasMore: false };
    const revisions = hasUpstream ? ['HEAD', '@{upstream}'] : ['HEAD'];
    // Ask for one extra to learn whether more exist.
    const res = await GitProcess.exec(['rev-list', '--topo-order', '-n', String(this.graphLimit + 1), ...revisions, '--'], {
      cwd: root,
    });
    const hashes = res.stdout.split('\n').filter(Boolean);
    const commits = await CommitService.getCommitsByHashes(root, hashes.slice(0, this.graphLimit));
    return { commits, hasMore: hashes.length > this.graphLimit };
  }

  /** Show more of the graph; the next refresh includes them. */
  public showMoreGraph(): void {
    this.graphLimit += GRAPH_PAGE;
  }

  /** Carry out an action. Returns a message to show, or text to put back in the commit box. */
  public async run(action: ScmAction): Promise<{ message?: string; commitMessage?: string } | undefined> {
    const root = this.activeRoot;
    if (!root) throw new Error('Open a folder with a Git repository first.');
    const svc = SourceControlService;

    try {
      switch (action.kind) {
        case 'stage':
          return void (await svc.stage(root, action.paths));
        case 'stageAll':
          return void (await svc.stageAll(root));
        case 'unstage':
          return void (await svc.unstage(root, action.paths));
        case 'unstageAll':
          return void (await svc.unstageAll(root));

        case 'discard':
        case 'discardAll': {
          const changes =
            action.kind === 'discard' ? action.changes : (await svc.getStatus(root)).unstaged;
          if (!changes.length || !(await this.confirmDiscard(changes))) return;
          await svc.discard(root, changes);
          return;
        }

        case 'commit': {
          const status = await svc.getStatus(root);
          if (!action.amend && !status.staged.length) {
            if (status.conflicts.length) throw new Error('Resolve and stage the merge conflicts first.');
            if (!status.unstaged.length) throw new Error('There are no changes to commit.');
            const choice = await vscode.window.showWarningMessage(
              'There are no staged changes. Stage all your changes and commit them?',
              { modal: true },
              'Stage All and Commit'
            );
            if (!choice) return;
            await svc.stageAll(root);
          }
          await svc.commit(root, action.message, { amend: action.amend });
          this.onHistoryChanged();
          if (action.then === 'push') await svc.push(root);
          if (action.then === 'sync') await svc.sync(root);
          return { message: action.amend ? 'Amended the last commit.' : undefined, commitMessage: '' };
        }

        case 'undoLastCommit': {
          const message = await svc.undoLastCommit(root);
          this.onHistoryChanged();
          return { message: 'Undid the last commit. Its changes are staged.', commitMessage: message };
        }

        case 'lastCommitMessage':
          return { commitMessage: await svc.getLastCommitMessage(root) };

        case 'pull':
          await svc.pull(root);
          this.onHistoryChanged();
          return { message: 'Pulled the latest changes.' };
        case 'push':
          await svc.push(root);
          return { message: 'Pushed your commits.' };
        case 'sync':
          await svc.sync(root);
          this.onHistoryChanged();
          return { message: 'Synced with the remote.' };
        case 'fetch':
          await svc.fetch(root);
          return { message: 'Fetched from all remotes.' };

        case 'stash':
          await svc.stash(root, { includeUntracked: action.includeUntracked, message: action.message });
          return { message: 'Stashed your changes.' };
        case 'stashPop':
        case 'stashApply':
        case 'stashDrop': {
          const verb = action.kind === 'stashPop' ? 'pop' : action.kind === 'stashApply' ? 'apply' : 'drop';
          if (verb === 'drop') {
            const choice = await vscode.window.showWarningMessage(
              'Delete this stash? Its changes will be lost.',
              { modal: true },
              'Delete Stash'
            );
            if (!choice) return;
          }
          await svc.stashAction(root, verb, action.index);
          return;
        }

        case 'abortOperation': {
          const choice = await vscode.window.showWarningMessage(
            'Abort and go back to how things were before it started?',
            { modal: true },
            'Abort'
          );
          if (!choice) return;
          await svc.abortOperation(root);
          this.onHistoryChanged();
          return;
        }

        case 'switchBranch':
          return this.switchBranch(root);
      }
    } catch (err) {
      throw new Error(describeGitError(err));
    }
  }

  /** Open a changed file the way Source Control does: a diff, or the file itself. */
  public async open(file: WorkingFileChange, group: ScmFileGroup, mode: 'diff' | 'file'): Promise<void> {
    const root = this.activeRoot;
    if (!root) return;
    const onDisk = vscode.Uri.file(path.join(root, file.path));
    const name = path.basename(file.path);
    const at = (ref: string | null, filePath = file.path) => RevisionContentProvider.toUri(root, ref, filePath);

    if (mode === 'file' || group === 'conflicts' || file.status === 'U') {
      if (file.status === 'D' && group !== 'conflicts') {
        return void vscode.window.showInformationMessage(`${name} was deleted.`);
      }
      return void (await vscode.window.showTextDocument(onDisk, { preview: true }));
    }

    if (group === 'staged') {
      const before = file.status === 'A' ? at(null) : at('HEAD', file.oldPath ?? file.path);
      const after = file.status === 'D' ? at(null) : at(':0');
      return void (await vscode.commands.executeCommand('vscode.diff', before, after, `${name} (Index)`));
    }

    const after = file.status === 'D' ? at(null) : onDisk;
    await vscode.commands.executeCommand('vscode.diff', at(':0'), after, `${name} (Working Tree)`);
  }

  public async toggleStar(hash: string): Promise<void> {
    if (this.activeRoot) await this.storageService.toggleStar(this.activeRoot, hash);
  }

  public async getCommitFiles(hash: string): Promise<WorkingFileChange[]> {
    if (!this.activeRoot) return [];
    return SourceControlService.getCommitFiles(this.activeRoot, hash);
  }

  /** Open one file's change in a commit, against the commit's first parent. */
  public async openCommitFile(hash: string, parent: string | null, file: WorkingFileChange): Promise<void> {
    const root = this.activeRoot;
    if (!root) return;
    const at = (ref: string | null, filePath = file.path) => RevisionContentProvider.toUri(root, ref, filePath);
    const before = file.status === 'A' || !parent ? at(null) : at(parent, file.oldPath ?? file.path);
    const after = file.status === 'D' ? at(null) : at(hash);
    const short = (ref: string) => ref.slice(0, 7);
    const title = `${path.basename(file.path)} (${parent ? short(parent) : 'none'} ↔ ${short(hash)})`;
    await vscode.commands.executeCommand('vscode.diff', before, after, title, { preview: true });
  }

  public async generateCommitMessage(): Promise<{ message: string; source: 'ai' | 'local'; warning?: string }> {
    if (!this.activeRoot) throw new Error('Open a folder with a Git repository first.');
    const { files, diff } = await SourceControlService.getChangesForMessage(this.activeRoot);
    if (!files.length) throw new Error('There are no changes to describe.');
    return this.aiService.generateCommitMessage(files, diff);
  }

  /** The number shown on the activity bar icon, like Source Control's. */
  public static countChanges(state: ScmState): number {
    const status = state.status;
    return status ? status.staged.length + status.unstaged.length + status.conflicts.length : 0;
  }

  private async confirmDiscard(changes: WorkingFileChange[]): Promise<boolean> {
    const created = changes.filter((c) => c.status === 'U').length;
    const what = changes.length === 1 ? `the changes in ${path.basename(changes[0].path)}` : `${changes.length} files’ changes`;
    const detail = created
      ? `${created === changes.length ? 'These are new files, so they' : `${created} of them are new files, which`} will be deleted for good.`
      : 'This can’t be undone.';
    const choice = await vscode.window.showWarningMessage(`Discard ${what}?`, { modal: true, detail }, 'Discard');
    return choice === 'Discard';
  }

  private async switchBranch(root: string): Promise<{ message?: string } | undefined> {
    const branches = await BranchService.getBranches(root);
    type Item = vscode.QuickPickItem & { branch?: string; create?: boolean };
    const items: Item[] = [
      { label: '$(plus) Create new branch…', create: true },
      { label: 'Local', kind: vscode.QuickPickItemKind.Separator },
      ...branches
        .filter((b) => !b.isRemote)
        .map((b) => ({ label: `$(git-branch) ${b.name}`, description: b.isCurrent ? 'current' : b.lastCommitSubject, branch: b.name })),
      { label: 'Remote', kind: vscode.QuickPickItemKind.Separator },
      ...branches
        .filter((b) => b.isRemote && !b.name.endsWith('/HEAD'))
        .map((b) => ({ label: `$(cloud) ${b.name}`, description: b.lastCommitSubject, branch: b.name })),
    ];
    const picked = await vscode.window.showQuickPick(items, { placeHolder: 'Switch to a branch', matchOnDescription: true });
    if (!picked) return;

    if (picked.create) {
      const name = await vscode.window.showInputBox({
        prompt: 'New branch name. It starts from your current commit.',
        validateInput: (value) => (/^(?!-)[^\s~^:?*[\\]+$/.test(value.trim()) ? undefined : 'Enter a valid branch name.'),
      });
      if (!name) return;
      await BranchService.createBranch(root, name.trim(), 'HEAD');
    } else if (picked.branch) {
      const remote = branches.find((b) => b.isRemote && b.name === picked.branch);
      const localName = remote ? remote.name.slice(remote.name.indexOf('/') + 1) : picked.branch;
      if (remote && !branches.some((b) => !b.isRemote && b.name === localName)) {
        // Like VS Code: a remote branch gets a local branch that tracks it.
        await GitProcess.exec(['checkout', '--track', remote.name], { cwd: root });
      } else {
        await BranchService.checkout(root, localName);
      }
    }
    this.onHistoryChanged();
    return;
  }
}
