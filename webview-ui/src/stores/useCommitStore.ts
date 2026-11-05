import { create } from 'zustand';
import {
  AnalyticsData,
  Branch,
  CommitComparisonResult,
  CommitDetails,
  CommitFilterOptions,
  FileHistoryCommit,
  GitCommit,
  RepositoryInfo,
  SavedFilter,
  Tag,
  ViewMode,
} from '../types';
import { vscode } from '../vscode';
import { HistorySelection, WORKING_COPY, pickSide } from '../utils/fileHistory';
import { clearFileContentCache } from '../utils/fileContent';

const HISTORY_PAGE_SIZE = 100;
const SEARCH_DEBOUNCE_MS = 250;

export interface FileHistoryState extends HistorySelection {
  filePath: string | null;
  commits: FileHistoryCommit[];
  hasMore: boolean;
  isModified: boolean;
  loading: boolean;
  loadingMore: boolean;
}

const EMPTY_FILE_HISTORY: FileHistoryState = {
  filePath: null,
  commits: [],
  hasMore: false,
  isModified: false,
  loading: false,
  loadingMore: false,
  activeKey: null,
  pickA: null,
  pickB: null,
};

type DiffLayout = 'split' | 'inline';

export interface ConfirmRequest {
  title: string;
  detail?: string;
  label: string;
  danger?: boolean;
  onConfirm: () => void;
}

// Only the latest history request may update the store.
let latestHistoryRequest = 0;

let latestCommitQuery = 0;
let searchTimer: ReturnType<typeof setTimeout> | undefined;

/** Results are ignored unless they answer the newest query, since older ones can finish later. */
export const isLatestCommitQuery = (seq?: number): boolean =>
  seq === undefined || seq === latestCommitQuery;

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
  fileHistory: FileHistoryState;
  trackedFiles: string[] | null;
  diffLayout: DiffLayout;
  pendingConfirm: ConfirmRequest | null;

  // Actions
  requestConfirm: (request: ConfirmRequest | null) => void;
  openFileHistory: (filePath: string) => Promise<void>;
  closeFileHistory: () => void;
  loadMoreFileHistory: () => Promise<void>;
  selectHistoryEntry: (key: string) => void;
  pickHistorySide: (side: 'A' | 'B', key: string) => void;
  swapHistoryPicks: () => void;
  clearHistoryPicks: () => void;
  loadTrackedFiles: () => void;
  resetRepositoryState: () => void;
  setDiffLayout: (layout: DiffLayout) => void;
  setViewMode: (mode: ViewMode) => void;
  setSearchQuery: (query: string) => void;
  setFilters: (filters: Partial<CommitFilterOptions>) => void;
  clearFilters: () => void;
  selectRepo: (repoPath: string) => void;
  loadRepositories: () => void;
  loadCommits: (page?: number) => void;
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
  fileHistory: EMPTY_FILE_HISTORY,
  trackedFiles: null,
  diffLayout: vscode.getState<{ diffLayout?: DiffLayout }>()?.diffLayout ?? 'split',
  pendingConfirm: null,

  requestConfirm: (pendingConfirm) => set({ pendingConfirm }),

  setViewMode: (viewMode) => {
    set({ viewMode, selectedCommitDetails: null, loadingDetails: false });
    if (viewMode === 'branches') {
      get().loadBranchesAndTags();
    } else if (viewMode === 'analytics') {
      get().loadAnalytics();
    } else if (viewMode === 'fileHistory') {
      get().loadTrackedFiles();
    }
  },

  setSearchQuery: (searchQuery) => {
    set({ searchQuery });
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => get().loadCommits(1), SEARCH_DEBOUNCE_MS);
  },

  setFilters: (newFilters) => {
    const updated = { ...get().filters, ...newFilters };
    set({ filters: updated });
    get().loadCommits(1);
  },

  clearFilters: () => {
    clearTimeout(searchTimer);
    set({ filters: {}, searchQuery: '' });
    get().loadCommits(1);
  },

  selectRepo: (repoPath: string) => {
    latestHistoryRequest++;
    vscode.postMessage({ type: 'SELECT_REPOSITORY', repoPath });
    set({ selectedCommitDetails: null });
  },

  loadRepositories: () => {
    vscode.postMessage({ type: 'GET_REPOSITORIES' });
    vscode.postMessage({ type: 'GET_SAVED_FILTERS' });
  },

  loadCommits: (page = 1) => {
    const { pageSize, filters, searchQuery } = get();
    const seq = ++latestCommitQuery;
    const query = searchQuery.trim();
    set({ loading: true, page });

    vscode.postMessage(
      query
        ? { type: 'SEARCH_COMMITS', query, page, pageSize, filters, seq }
        : { type: 'GET_COMMITS', page, pageSize, filters, seq }
    );
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

  openFileHistory: async (filePath) => {
    const request = ++latestHistoryRequest;
    set({
      viewMode: 'fileHistory',
      selectedCommitDetails: null,
      loadingDetails: false,
      fileHistory: { ...EMPTY_FILE_HISTORY, filePath, loading: true },
    });
    get().loadTrackedFiles();

    try {
      const res = await vscode.request({
        type: 'GET_FILE_HISTORY',
        filePath,
        offset: 0,
        limit: HISTORY_PAGE_SIZE,
      });
      if (request !== latestHistoryRequest) return;
      set({
        fileHistory: {
          ...EMPTY_FILE_HISTORY,
          filePath: res.filePath,
          commits: res.commits,
          hasMore: res.hasMore,
          isModified: res.isModified,
          activeKey: res.isModified ? WORKING_COPY : res.commits[0]?.hash ?? null,
        },
      });
    } catch {
      if (request === latestHistoryRequest) {
        set({ fileHistory: EMPTY_FILE_HISTORY });
      }
    }
  },

  closeFileHistory: () => {
    latestHistoryRequest++;
    set({ fileHistory: EMPTY_FILE_HISTORY });
  },

  loadMoreFileHistory: async () => {
    const { fileHistory } = get();
    if (!fileHistory.filePath || !fileHistory.hasMore || fileHistory.loadingMore) return;

    const request = ++latestHistoryRequest;
    set({ fileHistory: { ...fileHistory, loadingMore: true } });

    try {
      const res = await vscode.request({
        type: 'GET_FILE_HISTORY',
        filePath: fileHistory.filePath,
        offset: fileHistory.commits.length,
        limit: HISTORY_PAGE_SIZE,
      });
      if (request !== latestHistoryRequest) return;
      const current = get().fileHistory;
      set({
        fileHistory: {
          ...current,
          commits: [...current.commits, ...res.commits],
          hasMore: res.hasMore,
          loadingMore: false,
        },
      });
    } catch {
      if (request === latestHistoryRequest) {
        set({ fileHistory: { ...get().fileHistory, loadingMore: false } });
      }
    }
  },

  selectHistoryEntry: (key) => {
    set({ fileHistory: { ...get().fileHistory, activeKey: key, pickA: null, pickB: null } });
  },

  pickHistorySide: (side, key) => {
    const { fileHistory } = get();
    set({ fileHistory: { ...fileHistory, ...pickSide(fileHistory, side, key, fileHistory.commits) } });
  },

  swapHistoryPicks: () => {
    const { fileHistory } = get();
    set({ fileHistory: { ...fileHistory, pickA: fileHistory.pickB, pickB: fileHistory.pickA } });
  },

  clearHistoryPicks: () => {
    set({ fileHistory: { ...get().fileHistory, pickA: null, pickB: null } });
  },

  loadTrackedFiles: () => {
    vscode
      .request({ type: 'GET_TRACKED_FILES' })
      .then((res) => set({ trackedFiles: res.files }))
      .catch(() => set({ trackedFiles: [] }));
  },

  resetRepositoryState: () => {
    clearFileContentCache();
    set({ trackedFiles: null, compareResult: null });
    get().loadCommits(1);
    if (get().viewMode === 'fileHistory') {
      get().loadTrackedFiles();
    }
  },

  setDiffLayout: (diffLayout) => {
    set({ diffLayout });
    vscode.setState({ ...vscode.getState<object>(), diffLayout });
  },

  executeGitOp: async (op, params) => {
    vscode.postMessage({
      type: 'EXECUTE_GIT_OP',
      operation: op,
      params,
    });
  },
}));

