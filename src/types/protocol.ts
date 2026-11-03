import { Branch, CommitComparisonResult, CommitDetails, ContributorStats, FileHistoryCommit, GitCommit, RepositoryInfo, Tag } from './git';

export interface CommitFilterOptions {
  authors?: string[];
  excludeAuthors?: string[];
  since?: string;
  until?: string;
  dateType?: 'author' | 'committer';
  branch?: string;
  isMerge?: boolean;
  minFilesChanged?: number;
  filePath?: string;
}

export type CommitSortField = 'date-desc' | 'date-asc' | 'files-desc' | 'additions-desc' | 'deletions-desc' | 'author-asc' | 'message-asc';

export interface SavedFilter {
  id: string;
  name: string;
  query: string;
  filterOptions: CommitFilterOptions;
  createdAt: number;
}

export interface AnalyticsData {
  totalCommits: number;
  activeContributors: number;
  branchCount: number;
  totalInsertions: number;
  totalDeletions: number;
  dailyActivity: { date: string; commits: number; additions: number; deletions: number }[];
  weeklyActivity: { week: string; commits: number }[];
  contributorStats: ContributorStats[];
  topFiles: { path: string; changes: number }[];
  activityHeatmap: { date: string; count: number; level: 0 | 1 | 2 | 3 | 4 }[];
}

export type WebviewToExtensionAction =
  | { type: 'GET_REPOSITORIES' }
  | { type: 'SELECT_REPOSITORY'; repoPath: string }
  | { type: 'GET_COMMITS'; page: number; pageSize: number; filters?: CommitFilterOptions; sort?: CommitSortField; branch?: string }
  | { type: 'SEARCH_COMMITS'; query: string; page: number; pageSize: number }
  | { type: 'GET_COMMIT_DETAILS'; hash: string }
  | { type: 'GET_COMMIT_DIFF'; hash: string; filePath?: string }
  | { type: 'COMPARE_COMMITS'; baseHash: string; targetHash: string }
  | { type: 'GET_BRANCHES_TAGS' }
  | { type: 'GET_ANALYTICS' }
  | { type: 'GET_FILE_HISTORY'; filePath: string }
  | { type: 'EXECUTE_GIT_OP'; operation: 'checkout' | 'cherry-pick' | 'revert' | 'create-branch' | 'create-tag' | 'delete-branch'; params: Record<string, any> }
  | { type: 'GET_SAVED_FILTERS' }
  | { type: 'SAVE_FILTER'; filter: Omit<SavedFilter, 'id' | 'createdAt'> }
  | { type: 'DELETE_SAVED_FILTER'; id: string }
  | { type: 'GET_SETTINGS' }
  | { type: 'UPDATE_SETTINGS'; settings: Record<string, any> }
  | { type: 'AI_ACTION'; action: 'summarize' | 'nl_search' | 'release_notes' | 'explain'; payload: any }
  | { type: 'COPY_TO_CLIPBOARD'; text: string }
  | { type: 'OPEN_IN_EDITOR'; filePath: string; line?: number }
  | { type: 'OPEN_DIFF_EDITOR'; baseHash: string; targetHash: string; filePath: string };

export type WebviewMessage = WebviewToExtensionAction & { id?: string };

export type ExtensionToWebviewAction =
  | { type: 'REPOSITORIES_LOADED'; repositories: RepositoryInfo[]; activeRepo: RepositoryInfo | null }
  | { type: 'COMMITS_LOADED'; commits: GitCommit[]; totalCount: number; page: number; hasMore: boolean; activeBranch?: string }
  | { type: 'SEARCH_RESULTS'; commits: GitCommit[]; totalCount: number; page: number; hasMore: boolean }
  | { type: 'COMMIT_DETAILS_LOADED'; details: CommitDetails }
  | { type: 'DIFF_LOADED'; hash: string; diff: string; filePath?: string }
  | { type: 'COMPARE_RESULT_LOADED'; result: CommitComparisonResult }
  | { type: 'BRANCHES_TAGS_LOADED'; branches: Branch[]; tags: Tag[] }
  | { type: 'ANALYTICS_LOADED'; analytics: AnalyticsData }
  | { type: 'FILE_HISTORY_LOADED'; filePath: string; commits: FileHistoryCommit[] }
  | { type: 'GIT_OP_SUCCESS'; operation: string; message: string }
  | { type: 'GIT_OP_ERROR'; operation: string; error: string }
  | { type: 'SAVED_FILTERS_LOADED'; filters: SavedFilter[] }
  | { type: 'SETTINGS_LOADED'; settings: Record<string, any> }
  | { type: 'AI_RESULT'; action: string; result: any }
  | { type: 'ERROR'; message: string };

export type ExtensionMessage = ExtensionToWebviewAction & { requestId?: string };
