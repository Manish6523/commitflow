export interface GitAuthor {
  name: string;
  email: string;
  date: string;
  timestamp: number;
}

export interface GitCommit {
  hash: string;
  shortHash: string;
  treeHash: string;
  parentHashes: string[];
  author: GitAuthor;
  committer: GitAuthor;
  subject: string;
  body: string;
  branches: string[];
  tags: string[];
  isMerge: boolean;
  signatureStatus: 'G' | 'B' | 'U' | 'X' | 'Y' | 'R' | 'E' | 'N';
  filesChanged: number;
  insertions: number;
  deletions: number;
}

export type FileStatus = 'A' | 'M' | 'D' | 'R' | 'C' | 'U' | '?';

export interface FileChange {
  path: string;
  oldPath?: string;
  status: FileStatus;
  insertions: number;
  deletions: number;
  isBinary: boolean;
}

export interface CommitDetails extends GitCommit {
  files: FileChange[];
  diff?: string;
}

export interface Branch {
  name: string;
  fullName: string;
  isCurrent: boolean;
  isRemote: boolean;
  remoteName?: string;
  upstream?: string;
  ahead: number;
  behind: number;
  lastCommitHash: string;
  lastCommitSubject: string;
  lastCommitDate: string;
}

export interface Tag {
  name: string;
  hash: string;
  targetHash: string;
  isAnnotated: boolean;
  message?: string;
  taggerName?: string;
  taggerDate?: string;
}

export interface RepositoryInfo {
  rootUri: string;
  name: string;
  currentBranch: string;
  isDetached: boolean;
  remotes: { name: string; fetchUrl?: string; pushUrl?: string }[];
  headHash: string;
  isClean: boolean;
  uncommittedCount: number;
}

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

export type ViewMode = 'grid' | 'list' | 'timeline' | 'graph' | 'branches' | 'compare' | 'analytics' | 'settings';

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
  contributorStats: {
    name: string;
    email: string;
    commitCount: number;
    firstCommitDate: string;
    lastCommitDate: string;
    insertions: number;
    deletions: number;
    filesModified: number;
  }[];
  topFiles: { path: string; changes: number }[];
  activityHeatmap: { date: string; count: number; level: 0 | 1 | 2 | 3 | 4 }[];
}

export interface CommitComparisonResult {
  baseCommit: string;
  targetCommit: string;
  ahead: number;
  behind: number;
  files: FileChange[];
  totalInsertions: number;
  totalDeletions: number;
  diff: string;
}

