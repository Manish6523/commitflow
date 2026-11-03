import * as vscode from 'vscode';
import { SavedFilter } from '../types/protocol';

export class StorageService {
  private static readonly SAVED_FILTERS_KEY = 'commitflow.savedFilters';
  private static readonly LAST_VIEW_KEY = 'commitflow.lastViewMode';
  private static readonly LAST_REPO_KEY = 'commitflow.lastRepository';

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

  public getLastRepository(): string | undefined {
    return this.workspaceState.get<string>(StorageService.LAST_REPO_KEY);
  }

  public async setLastRepository(repoPath: string): Promise<void> {
    await this.workspaceState.update(StorageService.LAST_REPO_KEY, repoPath);
  }
}

