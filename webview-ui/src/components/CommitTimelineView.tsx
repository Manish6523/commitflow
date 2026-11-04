import React, { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { GitCommit } from '../types';
import { useCommitStore } from '../stores/useCommitStore';
import { timeAgo } from '../utils/fileHistory';
import { CommitActions, CommitStats, RefBadges } from './CommitBits';
import { TimelineRow } from './ui/TimelineRow';

const groupTitle = (timestamp: number): string => {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
};

export const CommitTimelineView: React.FC<{ commits: GitCommit[] }> = ({ commits }) => {
  const selectCommit = useCommitStore((state) => state.selectCommit);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const groups = useMemo(() => {
    const map = new Map<string, GitCommit[]>();
    for (const commit of commits) {
      const title = groupTitle(commit.author.timestamp);
      map.set(title, [...(map.get(title) ?? []), commit]);
    }
    return Array.from(map, ([title, list]) => ({ title, commits: list }));
  }, [commits]);

  return (
    <div className="w-full">
      {groups.map((group) => (
        <section key={group.title}>
          <button
            onClick={() => setCollapsed((prev) => ({ ...prev, [group.title]: !prev[group.title] }))}
            aria-expanded={!collapsed[group.title]}
            className="sticky top-0 z-20 w-full flex items-center gap-1.5 px-2 py-1 border-b border-vscode-border bg-vscode-sidebar text-left text-[11px] font-semibold text-gray-200"
          >
            <ChevronRight
              className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-150 ${
                collapsed[group.title] ? '' : 'rotate-90'
              }`}
            />
            {group.title}
            <span className="ml-auto font-normal text-gray-400">{group.commits.length}</span>
          </button>

          {!collapsed[group.title] && (
            <div className="py-1 animate-in fade-in duration-150">
              {group.commits.map((commit, index) => (
                <TimelineRow
                  key={commit.hash}
                  isLast={index === group.commits.length - 1}
                  dotClass={commit.isMerge ? 'bg-purple-500' : 'bg-blue-500'}
                  onClick={() => selectCommit(commit.hash)}
                  title={
                    <span className="flex items-center gap-1.5">
                      <span className="truncate" title={commit.subject}>
                        {commit.subject}
                      </span>
                      <RefBadges commit={commit} />
                    </span>
                  }
                  meta={
                    <>
                      <span className="font-mono">{commit.shortHash}</span> · {commit.author.name} ·{' '}
                      <span title={new Date(commit.author.timestamp).toLocaleString()}>
                        {timeAgo(commit.author.timestamp)}
                      </span>
                    </>
                  }
                  actions={
                    <>
                      <CommitStats commit={commit} />
                      <CommitActions commit={commit} />
                    </>
                  }
                />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
};
