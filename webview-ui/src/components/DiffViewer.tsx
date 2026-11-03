import React, { useState } from 'react';
import { Copy, Check, Columns, AlignJustify } from 'lucide-react';
import { vscode } from '../vscode';

interface DiffViewerProps {
  diff?: string;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ diff }) => {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'unified' | 'split'>('unified');

  if (!diff || !diff.trim()) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-gray-500 font-mono py-12">
        No diff output available or file is unchanged.
      </div>
    );
  }

  const lines = diff.split('\n');

  const copyAllDiff = () => {
    vscode.postMessage({ type: 'COPY_TO_CLIPBOARD', text: diff });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full rounded-lg border border-vscode-border bg-vscode-bg overflow-hidden font-mono text-xs">
      {/* Top toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-vscode-border bg-vscode-sidebar/80 select-none">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-400 font-sans">Diff Preview</span>
          <span className="text-[10px] text-gray-500">({lines.length} lines)</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewMode(viewMode === 'unified' ? 'split' : 'unified')}
            className="p-1 rounded hover:bg-vscode-hover text-gray-400 hover:text-white transition flex items-center gap-1 text-[11px]"
            title="Toggle Unified / Split layout"
          >
            {viewMode === 'unified' ? <Columns className="w-3.5 h-3.5" /> : <AlignJustify className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{viewMode === 'unified' ? 'Split' : 'Unified'}</span>
          </button>

          <button
            onClick={copyAllDiff}
            className="p-1 rounded hover:bg-vscode-hover text-gray-400 hover:text-white transition flex items-center gap-1 text-[11px]"
            title="Copy diff to clipboard"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Diff lines view */}
      <div className="flex-1 overflow-auto p-2 space-y-0.5 leading-relaxed">
        {lines.map((line, idx) => {
          let lineClass = 'text-gray-300';
          let bgClass = '';

          if (line.startsWith('+++') || line.startsWith('---')) {
            lineClass = 'text-gray-400 font-semibold';
            bgClass = 'bg-vscode-sidebar/50';
          } else if (line.startsWith('+')) {
            lineClass = 'text-emerald-300';
            bgClass = 'bg-emerald-950/40 hover:bg-emerald-950/60';
          } else if (line.startsWith('-')) {
            lineClass = 'text-rose-300';
            bgClass = 'bg-rose-950/40 hover:bg-rose-950/60';
          } else if (line.startsWith('@@')) {
            lineClass = 'text-cyan-400 font-semibold';
            bgClass = 'bg-cyan-950/30 my-1 py-0.5';
          } else if (line.startsWith('diff --git')) {
            lineClass = 'text-yellow-400 font-bold';
            bgClass = 'bg-yellow-950/20 border-t border-vscode-border mt-2 pt-1';
          }

          return (
            <div
              key={idx}
              className={`flex items-start px-2 py-0.5 rounded-sm transition ${bgClass} ${lineClass}`}
            >
              <span className="w-8 select-none text-gray-600 text-right pr-3 shrink-0 font-mono text-[10px]">
                {idx + 1}
              </span>
              <pre className="flex-1 font-mono text-xs whitespace-pre-wrap break-all select-text">
                {line}
              </pre>
            </div>
          );
        })}
      </div>
    </div>
  );
};

