import React, { useEffect, useMemo, useRef, useState } from 'react';
import { History, Search } from 'lucide-react';
import { DiffSide, FileChange } from '../../types';
import { EmptyState } from '../ui/EmptyState';
import { ResizableSplit } from '../ui/ResizableSplit';
import { StatusBadge } from '../ui/StatusBadge';
import { FileDiffPane } from './FileDiffPane';

interface DiffWorkspaceProps {
  files: FileChange[];
  baseRef: string | null;
  targetRef: string;
  baseLabel: string;
  targetLabel: string;
  onOpenHistory?: (filePath: string) => void;
}

const SHOW_FILTER_ABOVE = 8;

export const DiffWorkspace: React.FC<DiffWorkspaceProps> = ({
  files,
  baseRef,
  targetRef,
  baseLabel,
  targetLabel,
  onOpenHistory,
}) => {
  const [selectedPath, setSelectedPath] = useState<string | null>(files[0]?.path ?? null);
  const [filter, setFilter] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedPath(files[0]?.path ?? null);
    setFilter('');
  }, [files]);

  const visibleFiles = useMemo(() => {
    const query = filter.trim().toLowerCase();
    return query ? files.filter((f) => f.path.toLowerCase().includes(query)) : files;
  }, [files, filter]);

  const selected = files.find((f) => f.path === selectedPath) ?? null;

  const base: DiffSide | null =
    selected && baseRef && selected.status !== 'A'
      ? { ref: baseRef, path: selected.oldPath ?? selected.path, label: baseLabel }
      : null;
  const target: DiffSide | null =
    selected && selected.status !== 'D'
      ? { ref: targetRef, path: selected.path, label: targetLabel }
      : null;

  const onListKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const index = visibleFiles.findIndex((f) => f.path === selectedPath);
    const next = visibleFiles[index + (event.key === 'ArrowDown' ? 1 : -1)];
    if (next) {
      setSelectedPath(next.path);
      listRef.current
        ?.querySelector(`[data-index="${visibleFiles.indexOf(next)}"]`)
        ?.scrollIntoView({ block: 'nearest' });
    }
  };

  const fileList = (
    <div className="flex flex-col h-full bg-vscode-sidebar/30">
      <div className="px-3 py-2 border-b border-vscode-border flex items-center justify-between text-xs shrink-0">
        <span className="font-semibold text-gray-200">
          {files.length} {files.length === 1 ? 'file' : 'files'} changed
        </span>
        <span className="font-mono text-[11px] tabular-nums">
          <span className="text-emerald-500">+{files.reduce((n, f) => n + f.insertions, 0)}</span>{' '}
          <span className="text-rose-500">-{files.reduce((n, f) => n + f.deletions, 0)}</span>
        </span>
      </div>

      {files.length > SHOW_FILTER_ABOVE && (
        <div className="p-2 border-b border-vscode-border shrink-0 relative">
          <Search className="w-3 h-3 absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter files"
            aria-label="Filter files"
            className="w-full bg-vscode-input text-vscode-fg border border-vscode-inputBorder rounded pl-6 pr-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      )}

      <div
        ref={listRef}
        role="listbox"
        aria-label="Changed files"
        tabIndex={0}
        onKeyDown={onListKeyDown}
        className="flex-1 overflow-y-auto p-1 focus:outline-none"
      >
        {visibleFiles.map((file, index) => {
          const slash = file.path.lastIndexOf('/');
          const isSelected = file.path === selectedPath;
          return (
            <div
              key={file.path}
              role="option"
              aria-selected={isSelected}
              data-index={index}
              onClick={() => setSelectedPath(file.path)}
              title={file.oldPath ? `${file.oldPath} → ${file.path}` : file.path}
              className={`group flex items-center gap-2 px-2 py-1 rounded-md text-xs cursor-pointer transition-colors duration-100 ${
                isSelected ? 'bg-vscode-active text-vscode-activeFg' : 'hover:bg-vscode-hover text-gray-200'
              }`}
            >
              <StatusBadge status={file.status} />
              <span className="flex-1 min-w-0 flex items-baseline gap-1.5">
                <span className="truncate font-medium shrink">{file.path.slice(slash + 1)}</span>
                {slash > 0 && (
                  <span className="truncate text-[11px] opacity-60 shrink-[2]">
                    {file.path.slice(0, slash)}
                  </span>
                )}
              </span>
              {onOpenHistory && (
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenHistory(file.path);
                  }}
                  className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-0.5 rounded hover:bg-vscode-hover"
                  title="View file history"
                  aria-label={`View history of ${file.path}`}
                >
                  <History className="w-3 h-3" />
                </button>
              )}
              <span className="font-mono text-[10px] tabular-nums shrink-0">
                {file.isBinary ? (
                  <span className="opacity-60">bin</span>
                ) : (
                  <>
                    <span className="text-emerald-500">+{file.insertions}</span>{' '}
                    <span className="text-rose-500">-{file.deletions}</span>
                  </>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <ResizableSplit
      left={fileList}
      right={
        selected ? (
          <FileDiffPane base={base} target={target} />
        ) : (
          <EmptyState
            icon={<Search className="w-7 h-7" />}
            title="No file selected"
            detail="This change doesn’t include any files."
          />
        )
      }
    />
  );
};
