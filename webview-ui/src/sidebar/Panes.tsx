import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GitCommit, StashEntry, WorkingFileChange } from '../types';
import { fileName, folderOf, sortByPath } from './changeTree';
import { fileIcon } from './fileIcons';
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

type CommitFiles = WorkingFileChange[] | 'loading' | 'failed';

/**
 * Recent history with lanes for merges, like VS Code's Graph. Clicking a commit
 * lists the files it changed underneath; clicking a file opens its diff.
 */
export const GraphPane: React.FC<{ commits: GitCommit[]; hasMore: boolean; starred: string[] }> = ({ commits, hasMore, starred }) => {
  const { collapsed, toggleSection, run, openCommit } = useScmStore();
  const open = !collapsed.graph;
  const currentRow = useRef<HTMLDivElement>(null);
  // Bring the commit open in the dashboard into view.
  useEffect(() => {
    currentRow.current?.scrollIntoView({ block: 'nearest' });
  }, [openCommit, open]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [files, setFiles] = useState<Record<string, CommitFiles>>({});

  // How many rows sit under each expanded commit, so lanes stretch past them.
  const extraRows = (hash: string) => {
    if (!expanded.has(hash)) return 0;
    const list = files[hash];
    return Array.isArray(list) ? Math.max(1, list.length) : 1;
  };
  const centers = useMemo(() => {
    let top = 0;
    return commits.map((commit) => {
      const center = top + ROW_HEIGHT / 2;
      top += ROW_HEIGHT * (1 + extraRows(commit.hash));
      return center;
    });
  }, [commits, expanded, files]);
  const totalHeight = commits.reduce((sum, c) => sum + ROW_HEIGHT * (1 + extraRows(c.hash)), 0);

  const { nodes, totalLanes } = useMemo(
    () =>
      layoutGraph(commits, {
        rowHeight: ROW_HEIGHT,
        laneWidth: LANE_WIDTH,
        leftPad: LEFT_PAD,
        rowCenter: (index) => centers[index],
      }),
    [commits, centers]
  );
  const width = LEFT_PAD + totalLanes * LANE_WIDTH;
  const openInDashboard = (hash: string) => vscode.postMessage({ type: 'OPEN_DASHBOARD', hash });

  // Load older commits when the end of the graph scrolls into view, once per page.
  const endRef = useRef<HTMLDivElement>(null);
  const requestedAt = useRef(-1);
  const loadMore = () => {
    if (!hasMore || requestedAt.current === commits.length) return;
    requestedAt.current = commits.length;
    vscode.postMessage({ type: 'SCM_GRAPH_MORE' });
  };
  useEffect(() => {
    const end = endRef.current;
    if (!end || !hasMore) return;
    const observer = new IntersectionObserver((entries) => entries[0].isIntersecting && loadMore(), { rootMargin: '200px' });
    observer.observe(end);
    return () => observer.disconnect();
  }, [hasMore, commits.length, open]);

  const toggle = (hash: string) => {
    const next = new Set(expanded);
    if (next.has(hash)) {
      next.delete(hash);
    } else {
      next.add(hash);
      if (!Array.isArray(files[hash])) {
        setFiles((prev) => ({ ...prev, [hash]: 'loading' }));
        vscode
          .request<{ files: WorkingFileChange[] }>({ type: 'SCM_COMMIT_FILES', hash })
          .then((res) => setFiles((prev) => ({ ...prev, [hash]: res.files })))
          .catch(() => setFiles((prev) => ({ ...prev, [hash]: 'failed' })));
      }
    }
    setExpanded(next);
  };

  const openFile = (commit: GitCommit, file: WorkingFileChange) =>
    vscode.postMessage({ type: 'SCM_OPEN_COMMIT_FILE', hash: commit.hash, parent: commit.parentHashes[0] ?? null, file });

  return (
    <section>
      <SectionHeader pane title="Graph" open={open} onToggle={() => toggleSection('graph')}>
        <IconButton icon="repo-fetch" label="Fetch" onClick={() => run({ kind: 'fetch' })} />
        <IconButton icon="graph" label="Open CommitFlow Dashboard" onClick={() => vscode.postMessage({ type: 'OPEN_DASHBOARD' })} />
      </SectionHeader>
      {open && commits.length === 0 && <div className="scm-empty">No commits yet</div>}
      {open && commits.length > 0 && (
        <div style={{ position: 'relative' }}>
          <svg width={width} height={totalHeight} style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }} aria-hidden="true">
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
          {nodes.map(({ commit, lane }) => {
            const isOpen = expanded.has(commit.hash);
            const isStarred = starred.includes(commit.hash);
            const isCurrent = commit.hash === openCommit;
            const list = files[commit.hash];
            const laneX = LEFT_PAD + lane * LANE_WIDTH;
            return (
              <React.Fragment key={commit.hash}>
                <div
                  ref={isCurrent ? currentRow : undefined}
                  aria-current={isCurrent || undefined}
                  className={`scm-row scm-commit${isOpen ? ' is-open' : ''}${isStarred ? ' is-starred' : ''}${isCurrent ? ' is-current' : ''}`}
                  role="treeitem"
                  aria-expanded={isOpen}
                  tabIndex={0}
                  style={{ paddingLeft: width + 4 }}
                  data-vscode-context={JSON.stringify({ webviewSection: 'commit', hash: commit.hash, preventDefaultContextMenuItems: true })}
                  title={`${commit.shortHash} • ${commit.author.name} • ${new Date(commit.author.timestamp).toLocaleString()}\n\n${commit.subject}\n\nClick to see the files it changed.`}
                  onClick={() => toggle(commit.hash)}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggle(commit.hash);
                    }
                  }}
                >
                  <span className="scm-truncate" style={{ flex: '1 1 60%', minWidth: 48 }}>
                    {isStarred && <Icon name="star-full" style={{ fontSize: 12, color: '#f5b301', marginRight: 4, verticalAlign: -1 }} />}
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
                  <span className="scm-actions">
                    <IconButton
                      icon={isStarred ? 'star-full' : 'star-empty'}
                      label={isStarred ? 'Unstar Commit' : 'Star Commit'}
                      onClick={() => vscode.postMessage({ type: 'TOGGLE_STAR', hash: commit.hash })}
                    />
                    <IconButton icon="link-external" label="Open in CommitFlow" onClick={() => openInDashboard(commit.hash)} />
                  </span>
                </div>

                {isOpen && !Array.isArray(list) && (
                  <div className="scm-row scm-muted" style={{ paddingLeft: Math.max(width, laneX + 12) + 8 }}>
                    {list === 'failed' ? 'Couldn’t list the files.' : <Icon name="loading scm-spin" />}
                  </div>
                )}
                {isOpen && Array.isArray(list) && list.length === 0 && (
                  <div className="scm-row scm-muted" style={{ paddingLeft: Math.max(width, laneX + 12) + 8 }}>
                    No file changes
                  </div>
                )}
                {isOpen &&
                  Array.isArray(list) &&
                  sortByPath(list).map((file) => {
                    const icon = fileIcon(file.path);
                    const color = `var(--decor-${file.status})`;
                    return (
                      <div
                        key={file.path}
                        className={`scm-row${file.status === 'D' ? ' is-deleted' : ''}`}
                        role="treeitem"
                        tabIndex={0}
                        style={{ paddingLeft: Math.max(width, laneX + 12) + 8 }}
                        title={`${file.oldPath ? `${file.oldPath} → ` : ''}${file.path}\n\nClick to see this file’s change in ${commit.shortHash}.`}
                        onClick={() => openFile(commit, file)}
                        onKeyDown={(e) => e.key === 'Enter' && openFile(commit, file)}
                      >
                        <Icon name={icon.icon} style={{ color: icon.color }} />
                        <span className="scm-name scm-truncate" style={{ color, flexShrink: 0, maxWidth: '65%' }}>
                          {fileName(file.path)}
                        </span>
                        <span className="scm-dir scm-truncate">{folderOf(file.path)}</span>
                        <span className="scm-letter" style={{ color }}>
                          {file.status}
                        </span>
                      </div>
                    );
                  })}
              </React.Fragment>
            );
          })}
          {hasMore && (
            <div ref={endRef} className="scm-row scm-muted" style={{ paddingLeft: width + 4 }} onClick={loadMore} role="button" tabIndex={0}>
              {requestedAt.current === commits.length ? <Icon name="loading scm-spin" /> : 'Load more commits'}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
