import React, { useState, useMemo } from 'react';
import { Copy, Check, Columns, AlignJustify } from 'lucide-react';
import { vscode } from '../vscode';

interface DiffViewerProps {
  diff?: string;
  fileName?: string;
}

interface SplitLineRow {
  oldLineNum?: number;
  oldText?: string;
  newLineNum?: number;
  newText?: string;
  type: 'context' | 'modify' | 'add' | 'delete' | 'hunk';
  rawHeader?: string;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ diff, fileName }) => {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'unified' | 'split'>('unified');

  const copyAllDiff = () => {
    if (!diff) return;
    vscode.postMessage({ type: 'COPY_TO_CLIPBOARD', text: diff });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Parse lines for unified view
  const lines = useMemo(() => {
    return diff ? diff.split('\n') : [];
  }, [diff]);

  // Parse diff into side-by-side split rows
  const splitRows = useMemo(() => {
    if (!diff) return [];

    const rawLines = diff.split('\n');
    const rows: SplitLineRow[] = [];

    let oldLine = 1;
    let newLine = 1;

    let pendingDeletes: { lineNum: number; text: string }[] = [];
    let pendingAdds: { lineNum: number; text: string }[] = [];

    const flushPending = () => {
      const maxLen = Math.max(pendingDeletes.length, pendingAdds.length);
      for (let i = 0; i < maxLen; i++) {
        const del = pendingDeletes[i];
        const add = pendingAdds[i];
        rows.push({
          oldLineNum: del?.lineNum,
          oldText: del?.text,
          newLineNum: add?.lineNum,
          newText: add?.text,
          type: del && add ? 'modify' : del ? 'delete' : 'add',
        });
      }
      pendingDeletes = [];
      pendingAdds = [];
    };

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];

      if (line.startsWith('@@')) {
        flushPending();
        // Parse @@ -12,5 +12,8 @@
        const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
        if (match) {
          oldLine = parseInt(match[1], 10);
          newLine = parseInt(match[2], 10);
        }
        rows.push({
          type: 'hunk',
          rawHeader: line,
        });
        continue;
      }

      if (line.startsWith('diff --git') || line.startsWith('index ') || line.startsWith('---') || line.startsWith('+++')) {
        flushPending();
        rows.push({
          type: 'hunk',
          rawHeader: line,
        });
        continue;
      }

      if (line.startsWith('-')) {
        pendingDeletes.push({
          lineNum: oldLine++,
          text: line.substring(1),
        });
      } else if (line.startsWith('+')) {
        pendingAdds.push({
          lineNum: newLine++,
          text: line.substring(1),
        });
      } else {
        flushPending();
        const text = line.startsWith(' ') ? line.substring(1) : line;
        rows.push({
          oldLineNum: oldLine++,
          newLineNum: newLine++,
          oldText: text,
          newText: text,
          type: 'context',
        });
      }
    }

    flushPending();
    return rows;
  }, [diff]);

  if (!diff || !diff.trim()) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-xs text-gray-500 font-mono py-12 gap-1">
        <span>No changes to display in this view.</span>
        <span className="text-[11px] text-gray-600">Select another file or clear filters.</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full rounded-xl border border-vscode-border bg-vscode-bg overflow-hidden font-mono text-xs">
      {/* Top toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-vscode-border bg-vscode-sidebar/90 select-none shrink-0">
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="text-xs font-semibold text-gray-200 truncate">
            {fileName || 'Diff Preview'}
          </span>
          <span className="text-[10px] text-gray-400 font-mono bg-vscode-input px-1.5 py-0.5 rounded border border-vscode-border">
            {lines.length} lines
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Toggle between Unified and Split View */}
          <div className="flex items-center bg-vscode-input border border-vscode-border rounded-lg p-0.5 text-[11px]">
            <button
              onClick={() => setViewMode('unified')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md transition ${
                viewMode === 'unified' ? 'bg-blue-600 text-white font-medium' : 'text-gray-400 hover:text-white'
              }`}
            >
              <AlignJustify className="w-3 h-3" />
              <span>Unified</span>
            </button>
            <button
              onClick={() => setViewMode('split')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md transition ${
                viewMode === 'split' ? 'bg-blue-600 text-white font-medium' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Columns className="w-3 h-3" />
              <span>Split</span>
            </button>
          </div>

          <button
            onClick={copyAllDiff}
            className="p-1.5 rounded-lg hover:bg-vscode-hover text-gray-400 hover:text-white transition flex items-center gap-1 text-[11px] border border-vscode-border bg-vscode-input/50"
            title="Copy diff to clipboard"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Main Diff Content */}
      <div className="flex-1 overflow-auto select-text">
        {viewMode === 'unified' ? (
          /* UNIFIED DIFF VIEW */
          <div className="p-2 space-y-0.5 leading-relaxed">
            {lines.map((line, idx) => {
              let lineClass = 'text-gray-300';
              let bgClass = '';

              if (line.startsWith('+++') || line.startsWith('---')) {
                lineClass = 'text-gray-400 font-semibold';
                bgClass = 'bg-vscode-sidebar/50';
              } else if (line.startsWith('+')) {
                lineClass = 'text-emerald-300 font-medium';
                bgClass = 'bg-emerald-950/40 hover:bg-emerald-950/60';
              } else if (line.startsWith('-')) {
                lineClass = 'text-rose-300 font-medium';
                bgClass = 'bg-rose-950/40 hover:bg-rose-950/60';
              } else if (line.startsWith('@@')) {
                lineClass = 'text-cyan-400 font-semibold';
                bgClass = 'bg-cyan-950/30 my-1 py-0.5 rounded';
              } else if (line.startsWith('diff --git')) {
                lineClass = 'text-yellow-400 font-bold';
                bgClass = 'bg-yellow-950/20 border-t border-vscode-border mt-3 pt-1';
              }

              return (
                <div
                  key={idx}
                  className={`flex items-start px-2 py-0.5 rounded-sm transition ${bgClass} ${lineClass}`}
                >
                  <span className="w-10 select-none text-gray-600 text-right pr-3 shrink-0 font-mono text-[10px]">
                    {idx + 1}
                  </span>
                  <pre className="flex-1 font-mono text-xs whitespace-pre-wrap break-all">
                    {line}
                  </pre>
                </div>
              );
            })}
          </div>
        ) : (
          /* SPLIT (SIDE-BY-SIDE) VIEW */
          <div className="min-w-[700px] flex flex-col divide-y divide-vscode-border/30">
            {/* Split Column Headers */}
            <div className="grid grid-cols-2 bg-vscode-sidebar/60 border-b border-vscode-border text-[11px] font-sans font-semibold text-gray-400 px-3 py-1 sticky top-0 z-10 backdrop-blur">
              <div className="border-r border-vscode-border pr-2">Base / Previous</div>
              <div className="pl-2">Modified / New</div>
            </div>

            {splitRows.map((row, idx) => {
              if (row.type === 'hunk') {
                return (
                  <div
                    key={idx}
                    className="col-span-2 px-3 py-1 bg-cyan-950/25 text-cyan-400 font-semibold text-[11px]"
                  >
                    {row.rawHeader}
                  </div>
                );
              }

              return (
                <div key={idx} className="grid grid-cols-2 text-xs leading-relaxed">
                  {/* Left Column (Old) */}
                  <div
                    className={`flex items-start px-2 py-0.5 border-r border-vscode-border/50 overflow-hidden ${
                      row.type === 'delete' || row.type === 'modify'
                        ? 'bg-rose-950/35 text-rose-300'
                        : 'text-gray-300'
                    }`}
                  >
                    <span className="w-8 select-none text-gray-600 text-right pr-2 shrink-0 font-mono text-[10px]">
                      {row.oldLineNum ?? ''}
                    </span>
                    <pre className="flex-1 font-mono text-xs whitespace-pre-wrap break-all">
                      {row.oldText !== undefined ? row.oldText : ''}
                    </pre>
                  </div>

                  {/* Right Column (New) */}
                  <div
                    className={`flex items-start px-2 py-0.5 overflow-hidden ${
                      row.type === 'add' || row.type === 'modify'
                        ? 'bg-emerald-950/35 text-emerald-300'
                        : 'text-gray-300'
                    }`}
                  >
                    <span className="w-8 select-none text-gray-600 text-right pr-2 shrink-0 font-mono text-[10px]">
                      {row.newLineNum ?? ''}
                    </span>
                    <pre className="flex-1 font-mono text-xs whitespace-pre-wrap break-all">
                      {row.newText !== undefined ? row.newText : ''}
                    </pre>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
