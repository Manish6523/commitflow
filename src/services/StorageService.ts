import * as vscode from 'vscode';
import { SavedFilter } from '../types/protocol';

export class StorageService {
  private static readonly SAVED_FILTERS_KEY = 'commitflow.savedFilters';
  private static readonly LAST_VIEW_KEY = 'commitflow.lastViewMode';
  private static readonly LAST_REPO_KEY = 'commitflow.lastRepository';
  /** Starred commits, as full hashes, for each repository root. Kept across workspaces. */
  private static readonly STARRED_KEY = 'commitflow.starredCommits';

  /** The star being saved. Each save rewrites the list, so they run one at a time. */
  private starSave: Promise<unknown> = Promise.resolve();

  private readonly starListeners = new Set<(repoRoot: string) => void>();

  constructor(
    private readonly workspaceState: vscode.Memento,
    private readonly globalState: vscode.Memento
  ) {}

  public getSavedFilters(): SavedFilter[] {
    return this.workspaceState.get<SavedFilter[]>(StorageService.SAVED_FILTERS_KEY, [
      {
        id: 'default-all',
        name: 'All Commits',
        query: '',
        filterOptions: {},
        createdAt: Date.now(),
      },
      {
        id: 'default-merges',
        name: 'Merge Commits',
        query: 'is:merge',
        filterOptions: { isMerge: true },
        createdAt: Date.now(),
      },
    ]);
  }

  public async saveFilter(filter: Omit<SavedFilter, 'id' | 'createdAt'>): Promise<SavedFilter[]> {
    const filters = this.getSavedFilters();
    const newFilter: SavedFilter = {
      ...filter,
      id: `filter-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: Date.now(),
    };
    const updated = [newFilter, ...filters];
    await this.workspaceState.update(StorageService.SAVED_FILTERS_KEY, updated);
    return updated;
  }

  public async deleteFilter(id: string): Promise<SavedFilter[]> {
    const filters = this.getSavedFilters();
    const updated = filters.filter((f) => f.id !== id);
    await this.workspaceState.update(StorageService.SAVED_FILTERS_KEY, updated);
    return updated;
  }

  public getStarred(repoRoot: string): string[] {
    return this.globalState.get<Record<string, string[]>>(StorageService.STARRED_KEY, {})[repoRoot] ?? [];
  }

  /** Star or unstar a commit, and tell every view. Returns the new list. */
  public toggleStar(repoRoot: string, hash: string): Promise<string[]> {
    const save = this.starSave.then(() => this.saveToggledStar(repoRoot, hash));
    this.starSave = save.catch(() => undefined);
    return save;
  }

  private async saveToggledStar(repoRoot: string, hash: string): Promise<string[]> {
    const all = this.globalState.get<Record<string, string[]>>(StorageService.STARRED_KEY, {});
    const current = all[repoRoot] ?? [];
    const next = current.includes(hash) ? current.filter((h) => h !== hash) : [...current, hash];
    await this.globalState.update(StorageService.STARRED_KEY, { ...all, [repoRoot]: next });
    this.starListeners.forEach((listener) => listener(repoRoot));
    return next;
  }

  /** Listen for stars changing. Returns a function that stops listening. */
  public onStarsChanged(listener: (repoRoot: string) => void): () => void {
    this.starListeners.add(listener);
    return () => this.starListeners.delete(listener);
  }

  public getLastRepository(): string | undefined {
    return this.workspaceState.get<string>(StorageService.LAST_REPO_KEY);
  }

  public async setLastRepository(repoPath: string): Promise<void> {
    await this.workspaceState.update(StorageService.LAST_REPO_KEY, repoPath);
  }
}

