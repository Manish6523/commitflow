import React, { useMemo } from 'react';
import { GitCommit } from '../types';
import { CommitCard } from './CommitCard';
import { Calendar, ChevronDown, ChevronRight } from 'lucide-react';

interface CommitTimelineViewProps {
  commits: GitCommit[];
}

export const CommitTimelineView: React.FC<CommitTimelineViewProps> = ({ commits }) => {
  const [collapsedGroups, setCollapsedGroups] = React.useState<Record<string, boolean>>({});

  const toggleGroup = (group: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  const grouped = useMemo(() => {
    const groups: { title: string; commits: GitCommit[] }[] = [];
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const map = new Map<string, GitCommit[]>();

    for (const c of commits) {
      const cDate = new Date(c.author.timestamp);
      const cDateStr = cDate.toISOString().split('T')[0];

      let key = '';
      if (cDateStr === todayStr) {
        key = 'Today';
      } else if (cDateStr === yesterdayStr) {
        key = 'Yesterday';
      } else {
        key = cDate.toLocaleDateString(undefined, {
          month: 'long',
          year: 'numeric',
        });
      }

      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(c);
    }

    for (const [title, list] of map.entries()) {
      groups.push({ title, commits: list });
    }

    return groups;
  }, [commits]);

  return (
    <div className="flex flex-col gap-6 py-2 px-1 max-w-5xl mx-auto w-full">
      {grouped.map((group) => {
        const isCollapsed = collapsedGroups[group.title];

        return (
          <div key={group.title} className="flex flex-col">
            {/* Group Header */}
            <button
              onClick={() => toggleGroup(group.title)}
              className="flex items-center gap-2 py-2 px-3 rounded-lg bg-vscode-sidebar/90 border border-vscode-border hover:bg-vscode-hover transition text-left group sticky top-0 z-20 backdrop-blur"
            >
              {isCollapsed ? (
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-white" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-white" />
              )}
              <Calendar className="w-4 h-4 text-blue-400" />
              <span className="font-semibold text-xs text-gray-200">{group.title}</span>
              <span className="text-[11px] font-mono text-gray-400 ml-auto bg-vscode-input px-2 py-0.5 rounded-full border border-vscode-border">
                {group.commits.length} commit{group.commits.length === 1 ? '' : 's'}
              </span>
            </button>

            {/* Timeline nodes */}
            {!isCollapsed && (
              <div className="relative pl-6 ml-4 border-l-2 border-vscode-border/80 mt-3 space-y-4">
                {group.commits.map((commit) => (
                  <div key={commit.hash} className="relative">
                    {/* Timeline bullet */}
                    <div className="absolute -left-[31px] top-4 w-3 h-3 rounded-full bg-blue-500 border-2 border-vscode-bg shadow-sm" />
                    <CommitCard commit={commit} />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

