import { create } from 'zustand';
import {
  AnalyticsData,
  Branch,
  CommitComparisonResult,
  CommitDetails,
  CommitFilterOptions,
  GitCommit,
  RepositoryInfo,
  SavedFilter,
  Tag,
  ViewMode,
} from '../types';
import { vscode } from '../vscode';

interface CommitStoreState {
  repositories: RepositoryInfo[];
  activeRepo: RepositoryInfo | null;
  commits: GitCommit[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  loading: boolean;
  viewMode: ViewMode;
  searchQuery: string;
  filters: CommitFilterOptions;
  selectedCommitDetails: CommitDetails | null;
  loadingDetails: boolean;
  branches: Branch[];
  tags: Tag[];
  analytics: AnalyticsData | null;
  loadingAnalytics: boolean;
  savedFilters: SavedFilter[];
  compareResult: CommitComparisonResult | null;
  comparing: boolean;
  activeDiffFile?: string;

  // Actions
  setViewMode: (mode: ViewMode) => void;
  setSearchQuery: (query: string) => void;
  setFilters: (filters: Partial<CommitFilterOptions>) => void;
  clearFilters: () => void;
  selectRepo: (repoPath: string) => void;
  loadRepositories: () => void;
  loadCommits: (page?: number) => void;
  searchCommits: (query: string, page?: number) => void;
  selectCommit: (hash: string | null) => void;
  loadBranchesAndTags: () => void;
  loadAnalytics: () => void;
  compareCommits: (baseHash: string, targetHash: string) => void;
  saveCurrentFilter: (name: string) => void;
  deleteSavedFilter: (id: string) => void;
  executeGitOp: (op: 'checkout' | 'cherry-pick' | 'revert' | 'create-branch' | 'create-tag' | 'delete-branch', params: any) => Promise<void>;
}

export const useCommitStore = create<CommitStoreState>((set, get) => ({
  repositories: [],
  activeRepo: null,
  commits: [],
  totalCount: 0,
  page: 1,
  pageSize: 30,
  hasMore: false,
  loading: false,
  viewMode: 'grid',
  searchQuery: '',
  filters: {},
  selectedCommitDetails: null,
  loadingDetails: false,
  branches: [],
  tags: [],
  analytics: null,
  loadingAnalytics: false,
  savedFilters: [],
  compareResult: null,
  comparing: false,
  activeDiffFile: undefined,

  setViewMode: (viewMode) => {
    set({ viewMode });
    if (viewMode === 'branches') {
      get().loadBranchesAndTags();
    } else if (viewMode === 'analytics') {
      get().loadAnalytics();
    }
  },

  setSearchQuery: (searchQuery) => {
    set({ searchQuery });
    if (searchQuery.trim()) {
      get().searchCommits(searchQuery, 1);
    } else {
      get().loadCommits(1);
    }
  },

  setFilters: (newFilters) => {
    const updated = { ...get().filters, ...newFilters };
    set({ filters: updated });
    get().loadCommits(1);
  },

  clearFilters: () => {
    set({ filters: {}, searchQuery: '' });
    get().loadCommits(1);
  },

  selectRepo: (repoPath: string) => {
    vscode.postMessage({ type: 'SELECT_REPOSITORY', repoPath });
    set({ loading: true, page: 1, selectedCommitDetails: null });
  },

  loadRepositories: () => {
    vscode.postMessage({ type: 'GET_REPOSITORIES' });
    vscode.postMessage({ type: 'GET_SAVED_FILTERS' });
  },

  loadCommits: (page = 1) => {
    const { pageSize, filters } = get();
    set({ loading: true, page });
    vscode.postMessage({
      type: 'GET_COMMITS',
      page,
      pageSize,
      filters,
    });
  },

  searchCommits: (query: string, page = 1) => {
    const { pageSize } = get();
    set({ loading: true, page, searchQuery: query });
    vscode.postMessage({
      type: 'SEARCH_COMMITS',
      query,
      page,
      pageSize,
    });
  },

  selectCommit: (hash: string | null) => {
    if (!hash) {
      set({ selectedCommitDetails: null });
      return;
    }
    set({ loadingDetails: true });
    vscode.postMessage({ type: 'GET_COMMIT_DETAILS', hash });
  },

  loadBranchesAndTags: () => {
    vscode.postMessage({ type: 'GET_BRANCHES_TAGS' });
  },

  loadAnalytics: () => {
    set({ loadingAnalytics: true });
    vscode.postMessage({ type: 'GET_ANALYTICS' });
  },

  compareCommits: (baseHash: string, targetHash: string) => {
    set({ comparing: true, compareResult: null });
    vscode.postMessage({
      type: 'COMPARE_COMMITS',
      baseHash,
      targetHash,
    });
  },

  saveCurrentFilter: (name: string) => {
    const { searchQuery, filters } = get();
    vscode.postMessage({
      type: 'SAVE_FILTER',
      filter: {
        name,
        query: searchQuery,
        filterOptions: filters,
      },
    });
  },

  deleteSavedFilter: (id: string) => {
    vscode.postMessage({ type: 'DELETE_SAVED_FILTER', id });
  },

  executeGitOp: async (op, params) => {
    vscode.postMessage({
      type: 'EXECUTE_GIT_OP',
      operation: op,
      params,
    });
  },
}));

