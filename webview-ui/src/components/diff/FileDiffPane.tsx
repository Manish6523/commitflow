import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Columns2,
  ExternalLink,
  FileX2,
  Equal,
  Pilcrow,
  Rows2,
} from 'lucide-react';
import { useCommitStore } from '../../stores/useCommitStore';
import { DiffSide } from '../../types';
import { loadFileContent } from '../../utils/fileContent';
import { vscode } from '../../vscode';
import { EmptyState } from '../ui/EmptyState';
import { ghostButton, iconButton } from '../ui/styles';
import type { MonacoDiffHandle } from './MonacoDiffEditor';

// Monaco is only downloaded the first time a diff is shown.
const MonacoDiffEditor = lazy(() => import('./MonacoDiffEditor'));

interface FileDiffPaneProps {
  base: DiffSide | null;
  target: DiffSide | null;
}

interface LoadedDiff {
  original: string;
  modified: string;
  originalPath: string;
  modifiedPath: string;
}

type Notice = 'binary' | 'tooLarge' | 'identical' | 'missing' | 'error';

const NOTICES: Record<Notice, { icon: React.ReactNode; title: string; detail: string }> = {
  binary: {
    icon: <FileX2 className="w-7 h-7" />,
    title: 'Binary file',
    detail: 'This file can’t be shown as text. Try opening it in VS Code.',
  },
  tooLarge: {
    icon: <AlertTriangle className="w-7 h-7" />,
    title: 'File too large',
    detail: 'Files over 5 MB aren’t shown here.',
  },
  identical: {
    icon: <Equal className="w-7 h-7" />,
    title: 'No differences',
    detail: 'The file is identical in both versions.',
  },
  missing: {
    icon: <FileX2 className="w-7 h-7" />,
    title: 'File not found',
    detail: 'The file doesn’t exist in either version.',
  },
  error: {
    icon: <AlertTriangle className="w-7 h-7" />,
    title: 'Couldn’t load this file',
    detail: 'Git didn’t return the file contents. Try selecting it again.',
  },
};

export const FileDiffPane: React.FC<FileDiffPaneProps> = ({ base, target }) => {
  const { diffLayout, setDiffLayout } = useCommitStore();
  const [diff, setDiff] = useState<LoadedDiff | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(true);
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false);
  const [changeCount, setChangeCount] = useState<number | null>(null);
  const editorRef = useRef<MonacoDiffHandle>(null);

  const filePath = target?.path ?? base?.path ?? '';
  const baseKey = base && `${base.ref}:${base.path}`;
  const targetKey = target && `${target.ref}:${target.path}`;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([loadFileContent(base), loadFileContent(target)])
      .then(([original, modified]) => {
        if (cancelled) return;
        const next: Notice | null =
          original.isBinary || modified.isBinary
            ? 'binary'
            : original.tooLarge || modified.tooLarge
            ? 'tooLarge'
            : !original.exists && !modified.exists
            ? 'missing'
            : original.content === modified.content
            ? 'identical'
            : null;

        setNotice(next);
        if (!next) {
          // The old diff stays on screen until this swap, so moving between
          // files never flashes an empty pane.
          setDiff({
            original: original.content,
            modified: modified.content,
            originalPath: base?.path ?? filePath,
            modifiedPath: filePath,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setNotice('error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [baseKey, targetKey]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'F7') {
        event.preventDefault();
        editorRef.current?.goToChange(event.shiftKey ? 'previous' : 'next');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const openNativeDiff = () => {
    vscode.postMessage({
      type: 'OPEN_DIFF_EDITOR',
      baseHash: base?.ref ?? null,
      targetHash: target?.ref ?? null,
      basePath: base?.path,
      filePath,
    });
  };

  const showEditor = diff && !notice;

  return (
    <div className="relative flex flex-col h-full min-w-0 bg-vscode-bg">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-1.5 border-b border-vscode-border bg-vscode-sidebar/60 shrink-0">
        <div className="flex items-center gap-2 min-w-0 text-xs">
          <span className="font-mono font-semibold text-gray-100 truncate" title={filePath}>
            {filePath.split('/').pop()}
          </span>
          <span className="flex items-center gap-1 font-mono text-[11px] text-gray-400 shrink-0">
            <span>{base?.label ?? 'none'}</span>
            <ArrowRight className="w-3 h-3" />
            <span>{target?.label ?? 'none'}</span>
          </span>
          {base && target && base.path !== target.path && (
            <span className="text-[11px] text-purple-500 truncate">renamed from {base.path}</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {showEditor && changeCount !== null && (
            <span className="text-[11px] text-gray-400 mr-1 tabular-nums">
              {changeCount} {changeCount === 1 ? 'change' : 'changes'}
            </span>
          )}
          <button
            onClick={() => editorRef.current?.goToChange('previous')}
            disabled={!showEditor}
            className={iconButton}
            title="Previous change (Shift+F7)"
            aria-label="Previous change"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => editorRef.current?.goToChange('next')}
            disabled={!showEditor}
            className={iconButton}
            title="Next change (F7)"
            aria-label="Next change"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-4 bg-vscode-border mx-1" />

          <button
            onClick={() => setDiffLayout('split')}
            className={`${iconButton} ${diffLayout === 'split' ? 'bg-vscode-hover text-vscode-fg' : ''}`}
            title="Side by side"
            aria-label="Side by side"
            aria-pressed={diffLayout === 'split'}
          >
            <Columns2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setDiffLayout('inline')}
            className={`${iconButton} ${diffLayout === 'inline' ? 'bg-vscode-hover text-vscode-fg' : ''}`}
            title="Inline"
            aria-label="Inline"
            aria-pressed={diffLayout === 'inline'}
          >
            <Rows2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIgnoreWhitespace((value) => !value)}
            className={`${iconButton} ${ignoreWhitespace ? 'bg-vscode-hover text-vscode-fg' : ''}`}
            title="Ignore whitespace changes"
            aria-label="Ignore whitespace changes"
            aria-pressed={ignoreWhitespace}
          >
            <Pilcrow className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-4 bg-vscode-border mx-1" />

          <button
            onClick={openNativeDiff}
            className={ghostButton}
            title="Open in VS Code's diff editor"
          >
            <ExternalLink className="w-3 h-3" />
            <span className="hidden lg:inline">Open in VS Code</span>
          </button>
        </div>
      </div>

      {loading && <div className="cf-progress" role="progressbar" aria-label="Loading diff" />}

      <div className="relative flex-1 min-h-0 select-text">
        {diff && (
          <div className={`h-full ${notice ? 'invisible' : ''}`}>
            <Suspense fallback={<div className="cf-progress" role="progressbar" aria-label="Loading diff editor" />}>
              <MonacoDiffEditor
                ref={editorRef}
                {...diff}
                layout={diffLayout}
                ignoreWhitespace={ignoreWhitespace}
                onChangeCount={setChangeCount}
              />
            </Suspense>
          </div>
        )}
        {notice && (
          <div className="absolute inset-0 bg-vscode-bg animate-in fade-in duration-200">
            <EmptyState {...NOTICES[notice]} />
          </div>
        )}
      </div>
    </div>
  );
};
