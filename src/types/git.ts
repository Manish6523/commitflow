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

export interface FileHistoryCommit {
  hash: string;
  shortHash: string;
  author: GitAuthor;
  subject: string;
  status: FileStatus;
  insertions: number;
  deletions: number;
}

export interface ContributorStats {
  name: string;
  email: string;
  aliases: string[];
  commitCount: number;
  firstCommitDate: string;
  lastCommitDate: string;
  insertions: number;
  deletions: number;
  filesModified: number;
}

