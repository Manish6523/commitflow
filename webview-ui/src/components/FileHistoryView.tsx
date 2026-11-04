import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  ArrowRight,
  ChevronsUpDown,
  ExternalLink,
  GitCommit,
  History,
  PencilLine,
  Search,
  X,
} from 'lucide-react';
import { useCommitStore } from '../stores/useCommitStore';
import { FileHistoryCommit } from '../types';
import { WORKING_COPY, resolveComparison, timeAgo } from '../utils/fileHistory';
import { vscode } from '../vscode';
import { FileDiffPane } from './diff/FileDiffPane';
import { FilePicker } from './FilePicker';
import { EmptyState } from './ui/EmptyState';
import { ResizableSplit } from './ui/ResizableSplit';
import { CommitRowsSkeleton } from './ui/Skeletons';
import { StatusBadge } from './ui/StatusBadge';
import { TimelineRow } from './ui/TimelineRow';

interface PickButtonProps {
  side: 'A' | 'B';
  rowKey: string;
  picked: boolean;
}

const PickButton: React.FC<PickButtonProps> = ({ side, rowKey, picked }) => {
  const pickHistorySide = useCommitStore((state) => state.pickHistorySide);
  return (
    <button
      onClick={(event) => {
        event.stopPropagation();
        pickHistorySide(side, rowKey);
      }}
      aria-pressed={picked}
      aria-label={`Use as version ${side}`}
      title={`Use as version ${side}`}
      className={`w-5 h-5 rounded text-[10px] font-bold transition-all duration-100 ${
        picked
          ? 'bg-blue-600 text-white opacity-100'
          : 'border border-vscode-border text-gray-300 hover:bg-vscode-hover opacity-0 group-hover:opacity-100 focus:opacity-100'
      }`}
    >
      {side}
    </button>
  );
};

interface HistoryRowProps {
  rowKey: string;
  active: boolean;
  isLast: boolean;
  pickA: boolean;
  pickB: boolean;
  dotClass: string;
  title: React.ReactNode;
  meta: React.ReactNode;
  actions?: React.ReactNode;
}

const HistoryRow: React.FC<HistoryRowProps> = ({ rowKey, pickA, pickB, actions, ...row }) => {
  const selectHistoryEntry = useCommitStore((state) => state.selectHistoryEntry);
  return (
    <TimelineRow
      {...row}
      onClick={() => selectHistoryEntry(rowKey)}
      rowProps={{ role: 'option', 'aria-selected': row.active, 'data-key': rowKey }}
      actions={
        <>
          {actions}
          <PickButton side="A" rowKey={rowKey} picked={pickA} />
          <PickButton side="B" rowKey={rowKey} picked={pickB} />
        </>
      }
    />
  );
};

const commitDotClass = (status: string): string =>
  status === 'A' ? 'bg-emerald-500' : status === 'D' ? 'bg-rose-500' : status === 'R' ? 'bg-purple-500' : 'bg-blue-500';

export const FileHistoryView: React.FC = () => {
  const {
    fileHistory,
    trackedFiles,
    openFileHistory,
    loadMoreFileHistory,
    loadTrackedFiles,
    selectHistoryEntry,
    swapHistoryPicks,
    clearHistoryPicks,
    selectCommit,
  } = useCommitStore();
  const { filePath, commits, hasMore, isModified, loading, loadingMore, activeKey, pickA, pickB } =
    fileHistory;

  const [changingFile, setChangingFile] = useState(false);
  const [filter, setFilter] = useState('');
  const sentinelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (trackedFiles === null) loadTrackedFiles();
  }, [trackedFiles]);

  useEffect(() => {
    setChangingFile(false);
    setFilter('');
  }, [filePath]);

  // Load the next page as the end of the list scrolls into view.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => entries[0].isIntersecting && loadMoreFileHistory(),
      { root: listRef.current, rootMargin: '200px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, commits.length, loadMoreFileHistory]);

  const visibleCommits = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return commits;
    return commits.filter(
      (c) =>
        c.subject.toLowerCase().includes(query) ||
        c.author.name.toLowerCase().includes(query) ||
        c.hash.startsWith(query)
    );
  }, [commits, filter]);

  const comparison = useMemo(
    () => (filePath ? resolveComparison(filePath, commits, { activeKey, pickA, pickB }) : null),
    [filePath, commits, activeKey, pickA, pickB]
  );

  if (!filePath) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-xl mx-auto px-6 pt-[12vh] pb-8 flex flex-col items-center gap-5">
          <div className="flex flex-col items-center gap-1.5 text-center">
            <History className="w-8 h-8 text-blue-500 mb-1" />
            <h2 className="text-base font-semibold text-gray-100">File History</h2>
            <p className="text-xs text-gray-400">
              Pick a file to see every commit that changed it and compare any two versions.
            </p>
          </div>
          <FilePicker files={trackedFiles} onSelect={openFileHistory} autoFocus />
        </div>
      </div>
    );
  }

  const comparing = Boolean(pickA && pickB);
  const labelFor = (key: string | null) =>
    key === WORKING_COPY ? 'Working copy' : commits.find((c) => c.hash === key)?.shortHash ?? '';

  const moveSelection = (event: React.KeyboardEvent) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const keys = [WORKING_COPY, ...visibleCommits.map((c) => c.hash)];
    const next = keys[keys.indexOf(activeKey ?? '') + (event.key === 'ArrowDown' ? 1 : -1)];
    if (next) {
      selectHistoryEntry(next);
      listRef.current?.querySelector(`[data-key="${next}"]`)?.scrollIntoView({ block: 'nearest' });
    }
  };

  const fileName = filePath.split('/').pop();
  const directory = filePath.slice(0, -(fileName?.length ?? 0) - 1);

  const sidebar = (
    <div className="relative flex flex-col h-full bg-vscode-sidebar/30">
      <div className="px-3 py-2 border-b border-vscode-border shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setChangingFile((value) => !value)}
            className="flex-1 min-w-0 flex items-center gap-1.5 text-left rounded-md px-1.5 py-1 -mx-1.5 hover:bg-vscode-hover transition-colors"
            title="Choose another file"
            aria-expanded={changingFile}
          >
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-gray-100 truncate">{fileName}</span>
              {directory && <span className="block text-[11px] text-gray-400 truncate">{directory}</span>}
            </span>
            <ChevronsUpDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          </button>
          <button
            onClick={() => vscode.postMessage({ type: 'OPEN_IN_EDITOR', filePath })}
            className="p-1.5 rounded-md text-gray-300 hover:text-vscode-fg hover:bg-vscode-hover transition-colors"
            title="Open file in editor"
            aria-label="Open file in editor"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="relative mt-1.5">
          <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={`Filter ${commits.length}${hasMore ? '+' : ''} commits`}
            aria-label="Filter commits"
            className="w-full bg-vscode-input text-vscode-fg border border-vscode-inputBorder rounded pl-6 pr-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {changingFile && (
        <div className="absolute left-2 right-2 top-14 z-20 animate-in fade-in slide-in-from-top-1 duration-150">
          <FilePicker
            files={trackedFiles}
            onSelect={openFileHistory}
            onCancel={() => setChangingFile(false)}
            autoFocus
          />
        </div>
      )}

      {comparing && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-vscode-border bg-blue-500/10 text-xs shrink-0 animate-in fade-in slide-in-from-top-1 duration-150">
          <span className="font-bold text-blue-500">A</span>
          <span className="font-mono truncate">{labelFor(pickA)}</span>
          <ArrowRight className="w-3 h-3 shrink-0 text-gray-400" />
          <span className="font-bold text-blue-500">B</span>
          <span className="font-mono truncate">{labelFor(pickB)}</span>
          <span className="flex-1" />
          <button
            onClick={swapHistoryPicks}
            className="p-1 rounded hover:bg-vscode-hover transition-colors"
            title="Swap A and B"
            aria-label="Swap A and B"
          >
            <ArrowLeftRight className="w-3 h-3" />
          </button>
          <button
            onClick={clearHistoryPicks}
            className="p-1 rounded hover:bg-vscode-hover transition-colors"
            title="Stop comparing"
            aria-label="Stop comparing"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      <div
        ref={listRef}
        role="listbox"
        aria-label="File versions"
        tabIndex={0}
        onKeyDown={moveSelection}
        className="flex-1 overflow-y-auto py-1 focus:outline-none"
      >
        {loading ? (
          <CommitRowsSkeleton count={10} />
        ) : (
          <>
            <HistoryRow
              rowKey={WORKING_COPY}
              active={!comparing && activeKey === WORKING_COPY}
              isLast={visibleCommits.length === 0}
              pickA={pickA === WORKING_COPY}
              pickB={pickB === WORKING_COPY}
              dotClass={isModified ? 'bg-amber-500' : 'border-2 border-gray-500 bg-vscode-bg'}
              title="Working copy"
              meta={isModified ? 'Uncommitted changes' : 'No uncommitted changes'}
              actions={isModified ? <PencilLine className="w-3 h-3 text-amber-500" /> : undefined}
            />
            {visibleCommits.map((commit, index) => (
              <CommitRow
                key={commit.hash}
                commit={commit}
                active={!comparing && activeKey === commit.hash}
                isLast={index === visibleCommits.length - 1}
                pickA={pickA === commit.hash}
                pickB={pickB === commit.hash}
                onOpen={() => selectCommit(commit.hash)}
              />
            ))}
            {commits.length === 0 && (
              <div className="px-4 py-6 text-center text-xs text-gray-400">
                This file has no commits yet.
              </div>
            )}
            {commits.length > 0 && visibleCommits.length === 0 && (
              <div className="px-4 py-6 text-center text-xs text-gray-400">No matching commits</div>
            )}
            <div ref={sentinelRef} className="h-px" />
            {loadingMore && <CommitRowsSkeleton count={3} />}
          </>
        )}
      </div>
    </div>
  );

  return (
    <ResizableSplit
      initialWidth={360}
      minWidth={260}
      left={sidebar}
      right={
        comparison ? (
          <FileDiffPane base={comparison.base} target={comparison.target} />
        ) : (
          <EmptyState
            icon={<GitCommit className="w-7 h-7" />}
            title={loading ? 'Loading history…' : 'Select a version'}
            detail={loading ? undefined : 'Click a commit to see what it changed in this file.'}
          />
        )
      }
    />
  );
};

interface CommitRowProps {
  commit: FileHistoryCommit;
  active: boolean;
  isLast: boolean;
  pickA: boolean;
  pickB: boolean;
  onOpen: () => void;
}

const CommitRow: React.FC<CommitRowProps> = ({ commit, active, isLast, pickA, pickB, onOpen }) => (
  <HistoryRow
    rowKey={commit.hash}
    active={active}
    isLast={isLast}
    pickA={pickA}
    pickB={pickB}
    dotClass={commitDotClass(commit.status)}
    title={<span title={commit.subject}>{commit.subject}</span>}
    meta={
      <>
        <span className="font-mono">{commit.shortHash}</span> · {commit.author.name} ·{' '}
        <span title={new Date(commit.author.timestamp).toLocaleString()}>
          {timeAgo(commit.author.timestamp)}
        </span>
        {commit.oldPath && <> · renamed from {commit.oldPath.split('/').pop()}</>}
      </>
    }
    actions={
      <>
        <button
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
          className="p-0.5 rounded hover:bg-vscode-hover opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
          title="Open commit"
          aria-label={`Open commit ${commit.shortHash}`}
        >
          <GitCommit className="w-3.5 h-3.5" />
        </button>
        <span className="font-mono text-[10px] tabular-nums group-hover:hidden">
          {commit.isBinary ? (
            'bin'
          ) : (
            <>
              <span className="text-emerald-500">+{commit.insertions}</span>{' '}
              <span className="text-rose-500">-{commit.deletions}</span>
            </>
          )}
        </span>
        {commit.status !== 'M' && <StatusBadge status={commit.status} />}
      </>
    }
  />
);
