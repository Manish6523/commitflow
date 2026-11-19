import React, { useMemo } from 'react';
import { GitCommit, StashEntry } from '../types';
import { vscode } from '../vscode';
import { timeAgo } from '../utils/fileHistory';
import { LANE_COLORS, edgePath, layoutGraph } from '../utils/graphLayout';
import { useScmStore } from './scmStore';
import { Icon, IconButton, SectionHeader } from './bits';

const ROW_HEIGHT = 22;
const LANE_WIDTH = 12;
const LEFT_PAD = 14;

export const StashPane: React.FC<{ stashes: StashEntry[] }> = ({ stashes }) => {
  const { collapsed, toggleSection, run } = useScmStore();
  if (!stashes.length) return null;
  const open = !collapsed.stashes;

  return (
    <section>
      <SectionHeader pane title="Stashes" count={stashes.length} open={open} onToggle={() => toggleSection('stashes')} />
      {open &&
        stashes.map((stash) => (
          <div key={stash.index} className="scm-row" tabIndex={0} style={{ paddingLeft: 20 }} title={`stash@{${stash.index}} • ${stash.message}`}>
            <Icon name="git-stash" />
            <span className="scm-truncate" style={{ flex: 1 }}>
              {stash.message.replace(/^(On|WIP on) [^:]+: /, '')}
            </span>
            <span className="scm-actions">
              <IconButton icon="git-stash-apply" label="Apply Stash" onClick={() => run({ kind: 'stashApply', index: stash.index })} />
              <IconButton icon="git-stash-pop" label="Pop Stash" onClick={() => run({ kind: 'stashPop', index: stash.index })} />
              <IconButton icon="trash" label="Drop Stash" onClick={() => run({ kind: 'stashDrop', index: stash.index })} />
            </span>
            <span className="scm-muted" style={{ fontSize: 12, flexShrink: 0 }}>
              {timeAgo(new Date(stash.date).getTime())}
            </span>
          </div>
        ))}
    </section>
  );
};

/** Recent history of the current branch, with lanes for merges, like VS Code's Graph. */
export const GraphPane: React.FC<{ commits: GitCommit[] }> = ({ commits }) => {
  const { collapsed, toggleSection, run } = useScmStore();
  const open = !collapsed.graph;
  const { nodes, totalLanes } = useMemo(
    () => layoutGraph(commits, { rowHeight: ROW_HEIGHT, laneWidth: LANE_WIDTH, leftPad: LEFT_PAD }),
    [commits]
  );
  const width = LEFT_PAD + totalLanes * LANE_WIDTH;
  const openCommit = (hash: string) => vscode.postMessage({ type: 'OPEN_DASHBOARD', hash });

  return (
    <section>
      <SectionHeader pane title="Graph" open={open} onToggle={() => toggleSection('graph')}>
        <IconButton icon="repo-fetch" label="Fetch" onClick={() => run({ kind: 'fetch' })} />
        <IconButton icon="graph" label="Open CommitFlow Dashboard" onClick={() => vscode.postMessage({ type: 'OPEN_DASHBOARD' })} />
      </SectionHeader>
      {open && commits.length === 0 && <div className="scm-empty">No commits yet</div>}
      {open && commits.length > 0 && (
        <div style={{ position: 'relative' }}>
          <svg width={width} height={nodes.length * ROW_HEIGHT} style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }} aria-hidden="true">
            {nodes.map((node) =>
              node.parentCoords.map((parent, i) => (
                <path key={`${node.commit.hash}-${i}`} d={edgePath(node, parent)} fill="none" stroke={LANE_COLORS[node.lane % LANE_COLORS.length]} strokeWidth={1.5} />
              ))
            )}
            {nodes.map((node, i) => (
              <circle
                key={node.commit.hash}
                cx={node.x}
                cy={node.y}
                r={i === 0 ? 4 : 3.5}
                fill={i === 0 ? 'var(--vscode-sideBar-background)' : LANE_COLORS[node.lane % LANE_COLORS.length]}
                stroke={LANE_COLORS[node.lane % LANE_COLORS.length]}
                strokeWidth={i === 0 ? 2 : 0}
              />
            ))}
          </svg>
          {nodes.map(({ commit }) => (
            <div
              key={commit.hash}
              className="scm-row"
              tabIndex={0}
              style={{ paddingLeft: width + 4 }}
              data-vscode-context={JSON.stringify({ webviewSection: 'commit', hash: commit.hash, preventDefaultContextMenuItems: true })}
              title={`${commit.shortHash} • ${commit.author.name} • ${new Date(commit.author.timestamp).toLocaleString()}\n\n${commit.subject}`}
              onClick={() => openCommit(commit.hash)}
              onKeyDown={(e) => e.key === 'Enter' && openCommit(commit.hash)}
            >
              <span className="scm-truncate" style={{ flex: '1 1 60%', minWidth: 48 }}>
                {commit.subject}
              </span>
              {commit.branches.slice(0, 1).map((branch) => (
                <span key={branch} className="scm-ref" style={{ background: 'var(--vscode-badge-background)', color: 'var(--vscode-badge-foreground)' }} title={branch}>
                  <Icon name={branch.includes('/') ? 'cloud' : 'git-branch'} />
                  <span className="scm-truncate">{branch}</span>
                </span>
              ))}
              {commit.tags.slice(0, 1).map((tag) => (
                <span key={tag} className="scm-ref" style={{ border: '1px solid var(--vscode-badge-background)' }} title={tag}>
                  <Icon name="tag" />
                  <span className="scm-truncate">{tag}</span>
                </span>
              ))}
              <span className="scm-muted scm-truncate scm-graph-author">{commit.author.name}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
