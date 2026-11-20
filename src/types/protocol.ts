import {
  Branch,
  CommitComparisonResult,
  CompareMode,
  CompareSuggestions,
  MergeCheckResult,
  CommitDetails,
  ContributorStats,
  FileContent,
  FileHistoryResult,
  GitCommit,
  RepositoryInfo,
  StashEntry,
  Tag,
  WorkingFileChange,
  WorkingTreeStatus,
} from './git';

import { AISettingsUpdate, AIStatus } from '../services/AIService';

export interface CommitFilterOptions {
  authors?: string[];
  committers?: string[];
  excludeAuthors?: string[];
  since?: string;
  until?: string;
  dateType?: 'author' | 'committer';
  branch?: string;
  isMerge?: boolean;
  minFilesChanged?: number;
  filePath?: string;
  /** Only starred commits. */
  starred?: boolean;
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

/** Everything the Source Control sidebar shows. */
export interface ScmState {
  repositories: { name: string; root: string }[];
  activeRoot: string | null;
  status: WorkingTreeStatus | null;
  stashes: StashEntry[];
  commits: GitCommit[];
  /** Whether older commits exist beyond those in the graph. */
  commitsHasMore: boolean;
  starred: string[];
}

export type ScmFileGroup = 'conflicts' | 'staged' | 'changes';

export type ScmAction =
  | { kind: 'stage'; paths: string[] }
  | { kind: 'stageAll' }
  | { kind: 'unstage'; paths: string[] }
  | { kind: 'unstageAll' }
  | { kind: 'discard'; changes: WorkingFileChange[] }
  | { kind: 'discardAll' }
  | { kind: 'commit'; message: string; amend?: boolean; then?: 'push' | 'sync' }
  | { kind: 'undoLastCommit' }
  | { kind: 'lastCommitMessage' }
  | { kind: 'pull' }
  | { kind: 'push' }
  | { kind: 'sync' }
  | { kind: 'fetch' }
  | { kind: 'stash'; includeUntracked?: boolean; message?: string }
  | { kind: 'stashPop' | 'stashApply' | 'stashDrop'; index: number }
  | { kind: 'abortOperation' }
  | { kind: 'switchBranch' };

export type WebviewToExtensionAction =
  | { type: 'GET_REPOSITORIES' }
  | { type: 'SELECT_REPOSITORY'; repoPath: string }
  | { type: 'GET_COMMITS'; page: number; pageSize: number; filters?: CommitFilterOptions; sort?: CommitSortField; branch?: string; seq?: number }
  | { type: 'SEARCH_COMMITS'; query: string; page: number; pageSize: number; filters?: CommitFilterOptions; seq?: number }
  | { type: 'GET_COMMIT_DETAILS'; hash: string }
  | { type: 'GET_ADJACENT_COMMITS'; hash: string }
  | { type: 'GET_STARRED' }
  | { type: 'TOGGLE_STAR'; hash: string }
  /** The dashboard opened (or closed, with null) a commit's page. */
  | { type: 'COMMIT_OPENED'; hash: string | null }
  | { type: 'GET_COMMIT_DIFF'; hash: string; filePath?: string }
  | { type: 'COMPARE_COMMITS'; baseHash: string; targetHash: string; mode?: CompareMode }
  | { type: 'COMPARE_SUGGEST'; query: string; page?: number }
  | { type: 'CHECK_MERGE'; base: string; target: string }
  | { type: 'OPEN_MERGE_CONFLICT'; tree: string; path: string }
  | { type: 'GET_BRANCHES_TAGS' }
  | { type: 'GET_ANALYTICS' }
  | { type: 'GET_FILE_HISTORY'; filePath: string; offset?: number; limit?: number }
  | { type: 'GET_FILE_CONTENT'; ref: string; filePath: string }
  | { type: 'GET_TRACKED_FILES' }
  | { type: 'EXECUTE_GIT_OP'; operation: 'checkout' | 'cherry-pick' | 'revert' | 'create-branch' | 'create-tag' | 'delete-branch'; params: Record<string, any> }
  | { type: 'GET_SAVED_FILTERS' }
  | { type: 'SAVE_FILTER'; filter: Omit<SavedFilter, 'id' | 'createdAt'> }
  | { type: 'DELETE_SAVED_FILTER'; id: string }
  | { type: 'GET_SETTINGS' }
  | { type: 'UPDATE_SETTINGS'; settings: Record<string, any> }
  | { type: 'AI_ACTION'; action: 'summarize' | 'nl_search' | 'release_notes' | 'explain'; payload: any }
  | { type: 'COPY_TO_CLIPBOARD'; text: string }
  | { type: 'OPEN_IN_EDITOR'; filePath: string; line?: number }
  | { type: 'OPEN_DIFF_EDITOR'; baseHash: string | null; targetHash: string | null; filePath: string; basePath?: string }
  | { type: 'WEBVIEW_READY' }
  | { type: 'GET_AI_SETTINGS' }
  | { type: 'SAVE_AI_SETTINGS'; settings: AISettingsUpdate }
  | { type: 'TEST_AI_CONNECTION'; settings: AISettingsUpdate }
  | { type: 'SCM_GET_STATE' }
  | { type: 'SCM_SELECT_REPOSITORY'; root: string }
  | { type: 'SCM_ACTION'; action: ScmAction }
  | { type: 'SCM_OPEN'; file: WorkingFileChange; group: ScmFileGroup; mode: 'diff' | 'file' }
  | { type: 'SCM_GENERATE_MESSAGE' }
  | { type: 'SCM_FILE_HISTORY'; path: string }
  | { type: 'SCM_COMMIT_FILES'; hash: string }
  | { type: 'SCM_GRAPH_MORE' }
  | { type: 'SCM_OPEN_COMMIT_FILE'; hash: string; parent: string | null; file: WorkingFileChange }
  | { type: 'OPEN_DASHBOARD'; hash?: string };

export type WebviewMessage = WebviewToExtensionAction & { id?: string };

export type ExtensionToWebviewAction =
  | { type: 'REPOSITORIES_LOADED'; repositories: RepositoryInfo[]; activeRepo: RepositoryInfo | null }
  | { type: 'COMMITS_LOADED'; commits: GitCommit[]; totalCount: number; page: number; hasMore: boolean; activeBranch?: string; seq?: number }
  | { type: 'SEARCH_RESULTS'; commits: GitCommit[]; totalCount: number; page: number; hasMore: boolean; seq?: number }
  | { type: 'COMMIT_DETAILS_LOADED'; details: CommitDetails }
  | { type: 'ADJACENT_COMMITS'; hash: string; older: string | null; newer: string | null }
  | { type: 'STARRED_LOADED'; hashes: string[] }
  | { type: 'SCM_OPEN_COMMIT'; hash: string | null }
  | { type: 'SCM_COMMIT_FILES_LOADED'; hash: string; files: WorkingFileChange[] }
  | { type: 'DIFF_LOADED'; hash: string; diff: string; filePath?: string }
  | { type: 'COMPARE_RESULT_LOADED'; result: CommitComparisonResult }
  | { type: 'COMPARE_SUGGESTIONS'; query: string; page: number; suggestions: CompareSuggestions }
  | { type: 'MERGE_CHECKED'; result: MergeCheckResult }
  | { type: 'BRANCHES_TAGS_LOADED'; branches: Branch[]; tags: Tag[] }
  | { type: 'ANALYTICS_LOADED'; analytics: AnalyticsData }
  | ({ type: 'FILE_HISTORY_LOADED'; filePath: string } & FileHistoryResult)
  | ({ type: 'FILE_CONTENT_LOADED' } & FileContent)
  | { type: 'TRACKED_FILES_LOADED'; files: string[] }
  | { type: 'SWITCH_VIEW'; view: string }
  | { type: 'OPEN_FILE_HISTORY'; filePath: string }
  | { type: 'OPEN_COMMIT'; hash: string }
  | { type: 'FOCUS_SEARCH' }
  | { type: 'GIT_OP_SUCCESS'; operation: string; message: string }
  | { type: 'GIT_OP_ERROR'; operation: string; error: string }
  | { type: 'SAVED_FILTERS_LOADED'; filters: SavedFilter[] }
  | { type: 'SETTINGS_LOADED'; settings: Record<string, any> }
  | { type: 'SCM_STATE'; state: ScmState }
  /** The sidebar changed history, so the dashboard should reload what it shows. */
  | { type: 'HISTORY_CHANGED' }
  | { type: 'SCM_ACTION_DONE'; message?: string; commitMessage?: string }
  | { type: 'COMMIT_MESSAGE_GENERATED'; message: string; source: 'ai' | 'local'; warning?: string }
  | { type: 'AI_RESULT'; action: string; result: any }
  | ({ type: 'AI_SETTINGS_LOADED' } & AIStatus)
  | { type: 'AI_TEST_RESULT'; ok: boolean; message: string; models: string[] }
  | { type: 'ERROR'; message: string };

export type ExtensionMessage = ExtensionToWebviewAction & { requestId?: string };

