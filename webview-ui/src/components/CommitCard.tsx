import React from 'react';
import { GitCommit } from '../types';
import { useCommitStore } from '../stores/useCommitStore';
import { timeAgo } from '../utils/fileHistory';
import { CommitActions, CommitStats, RefBadges } from './CommitBits';

export const CommitCard: React.FC<{ commit: GitCommit }> = ({ commit }) => {
  const selectCommit = useCommitStore((state) => state.selectCommit);
  const hasRefs =
    commit.isMerge || commit.signatureStatus === 'G' || commit.branches.length + commit.tags.length > 0;

  return (
    <div
      onClick={() => selectCommit(commit.hash)}
      className="group relative flex flex-col gap-1 min-w-0 px-3 py-2.5 border-b border-r border-vscode-border cursor-pointer hover:bg-vscode-hover transition-colors duration-100"
    >
      <div className="text-xs font-medium text-gray-100 line-clamp-2 leading-snug" title={commit.subject}>
        {commit.subject}
      </div>
      {commit.body && <div className="text-[11px] text-gray-400 truncate">{commit.body}</div>}
      <div className="flex items-center justify-between gap-2 text-[11px] text-gray-400 mt-auto pt-0.5">
        <span className="truncate">
          <span className="font-mono">{commit.shortHash}</span> · {commit.author.name} ·{' '}
          <span title={new Date(commit.author.timestamp).toLocaleString()}>
            {timeAgo(commit.author.timestamp)}
          </span>
        </span>
        <CommitStats commit={commit} />
      </div>
      {hasRefs && (
        <div className="flex items-center gap-1 flex-wrap">
          <RefBadges commit={commit} />
        </div>
      )}
      <CommitActions commit={commit} />
    </div>
  );
};
