import React from 'react';
import { GitCommit } from '../types';
import { useCommitStore } from '../stores/useCommitStore';
import { timeAgo } from '../utils/fileHistory';
import { CommitActions, CommitStats, RefBadges } from './CommitBits';

export const CommitListView: React.FC<{ commits: GitCommit[] }> = ({ commits }) => {
  const selectCommit = useCommitStore((state) => state.selectCommit);

  return (
    <div className="w-full text-xs">
      <div className="sticky top-0 z-20 flex items-center gap-3 px-3 py-1 border-b border-vscode-border bg-vscode-sidebar text-[11px] font-medium text-gray-400">
        <span className="w-16 shrink-0">Commit</span>
        <span className="flex-1 min-w-0">Message</span>
        <span className="w-32 shrink-0 hidden md:block">Author</span>
        <span className="w-16 shrink-0 hidden sm:block">Date</span>
        <span className="w-16 shrink-0 text-right">Changes</span>
      </div>

      {commits.map((commit) => (
        <div
          key={commit.hash}
          onClick={() => selectCommit(commit.hash)}
          className="group relative flex items-center gap-3 px-3 py-1 cursor-pointer hover:bg-vscode-hover transition-colors duration-100"
        >
          <span className="w-16 shrink-0 font-mono text-[11px] text-gray-400">{commit.shortHash}</span>
          <span className="flex-1 min-w-0 flex items-center gap-1.5">
            <span className="truncate font-medium text-gray-200" title={commit.subject}>
              {commit.subject}
            </span>
            <RefBadges commit={commit} limit={1} />
          </span>
          <span className="w-32 shrink-0 hidden md:block truncate text-gray-300">{commit.author.name}</span>
          <span
            className="w-16 shrink-0 hidden sm:block text-[11px] text-gray-400"
            title={new Date(commit.author.timestamp).toLocaleString()}
          >
            {timeAgo(commit.author.timestamp)}
          </span>
          <span className="w-16 shrink-0 text-right">
            <CommitStats commit={commit} />
          </span>
          <CommitActions commit={commit} />
        </div>
      ))}
    </div>
  );
};
