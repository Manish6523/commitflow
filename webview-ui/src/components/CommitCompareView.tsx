import React, { useState, useMemo } from 'react';
import { useCommitStore } from '../stores/useCommitStore';
import {
  GitCompare,
  ArrowRight,
  Plus,
  Minus,
  ExternalLink,
  Search,
} from 'lucide-react';
import { DiffViewer } from './DiffViewer';
import { extractFileDiff } from '../utils/diff';
import { vscode } from '../vscode';

export const CommitCompareView: React.FC = () => {
  const { compareCommits, compareResult, comparing, commits } = useCommitStore();
  const [baseInput, setBaseInput] = useState('HEAD~1');
  const [targetInput, setTargetInput] = useState('HEAD');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const handleRunCompare = () => {
    if (baseInput.trim() && targetInput.trim()) {
      setSelectedFile(null);
      compareCommits(baseInput.trim(), targetInput.trim());
    }
  };

  const handleOpenNativeDiff = (filePath: string) => {
    vscode.postMessage({
      type: 'OPEN_DIFF_EDITOR',
      baseHash: compareResult?.baseCommit || baseInput,
      targetHash: compareResult?.targetCommit || targetInput,
      filePath,
    });
  };

  const toggleFile = (path: string) => {
    setSelectedFile((prev) => (prev === path ? null : path));
  };

  const activeDiff = useMemo(() => {
    if (!compareResult?.diff) return '';
    if (selectedFile) {
      return extractFileDiff(compareResult.diff, selectedFile);
    }
    return compareResult.diff;
  }, [compareResult?.diff, selectedFile]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-vscode-bg p-4 max-w-6xl mx-auto w-full select-none">
      {/* Header and Compare Input Form */}
      <div className="p-4 rounded-xl border border-vscode-border bg-vscode-sidebar/60 flex flex-col gap-3 shrink-0">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm text-gray-100 flex items-center gap-2">
            <GitCompare className="w-4 h-4 text-blue-400" />
            Compare Revisions
          </h3>
          <span className="text-xs text-gray-400">
            Compare commits, branches, tags, or HEAD
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
            <span className="text-xs text-gray-400 font-medium">Base:</span>
            <input
              type="text"
              value={baseInput}
              onChange={(e) => setBaseInput(e.target.value)}
              placeholder="e.g. main, HEAD~1, a82f91c"
              className="flex-1 bg-vscode-input text-vscode-fg border border-vscode-inputBorder rounded px-2.5 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <ArrowRight className="w-4 h-4 text-gray-400 shrink-0" />

          <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
            <span className="text-xs text-gray-400 font-medium">Target:</span>
            <input
              type="text"
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
              placeholder="e.g. HEAD, feature-branch, b93e11a"
              className="flex-1 bg-vscode-input text-vscode-fg border border-vscode-inputBorder rounded px-2.5 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={handleRunCompare}
            disabled={comparing || !baseInput.trim() || !targetInput.trim()}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-md shadow transition disabled:opacity-50 flex items-center gap-1.5"
          >
            <Search className="w-3.5 h-3.5" />
            <span>{comparing ? 'Comparing...' : 'Compare'}</span>
          </button>
        </div>

        {/* Quick select presets from recent commits */}
        {commits.length >= 2 && (
          <div className="flex items-center gap-2 text-[11px] text-gray-400 pt-1">
            <span>Quick:</span>
            <button
              onClick={() => {
                setBaseInput(commits[1].hash);
                setTargetInput(commits[0].hash);
                setSelectedFile(null);
                compareCommits(commits[1].hash, commits[0].hash);
              }}
              className="text-blue-400 hover:underline"
            >
              Latest 2 Commits ({commits[1].shortHash} ↔ {commits[0].shortHash})
            </button>
            <span>·</span>
            <button
              onClick={() => {
                setBaseInput('HEAD~1');
                setTargetInput('HEAD');
                setSelectedFile(null);
                compareCommits('HEAD~1', 'HEAD');
              }}
              className="text-blue-400 hover:underline"
            >
              HEAD~1 ↔ HEAD
            </button>
          </div>
        )}
      </div>

      {/* Comparison Results */}
      {compareResult && (
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row gap-4 mt-4">
          {/* Changed Files Sidebar */}
          <div className="w-full md:w-80 flex flex-col rounded-xl border border-vscode-border bg-vscode-sidebar/40 overflow-hidden shrink-0">
            <div className="p-3 border-b border-vscode-border bg-vscode-sidebar/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs text-gray-200">
                  Files ({compareResult.files.length})
                </span>
                <button
                  onClick={() => setSelectedFile(null)}
                  className={`px-2 py-0.5 rounded text-[11px] transition ${
                    selectedFile === null
                      ? 'bg-blue-600 text-white font-medium shadow-sm'
                      : 'text-gray-400 hover:text-white hover:bg-vscode-hover'
                  }`}
                  title="Show all files combined diff"
                >
                  All
                </button>
              </div>

              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="text-emerald-400 flex items-center">
                  <Plus className="w-3 h-3" />
                  {compareResult.totalInsertions}
                </span>
                <span className="text-rose-400 flex items-center">
                  <Minus className="w-3 h-3" />
                  {compareResult.totalDeletions}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {compareResult.files.map((file) => {
                const isSelected = selectedFile === file.path;
                return (
                  <div
                    key={file.path}
                    onClick={() => toggleFile(file.path)}
                    className={`p-2 rounded-lg text-xs font-mono flex items-center justify-between cursor-pointer transition ${
                      isSelected
                        ? 'bg-blue-600/25 text-blue-300 border border-blue-500/50 shadow-sm'
                        : 'hover:bg-vscode-hover text-gray-300 border border-transparent'
                    }`}
                    title={isSelected ? 'Click to show all files' : `Filter diff to ${file.path}`}
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span
                        className={`text-[10px] font-bold px-1 rounded ${
                          file.status === 'A'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : file.status === 'D'
                            ? 'bg-rose-500/20 text-rose-400'
                            : file.status === 'R'
                            ? 'bg-purple-500/20 text-purple-400'
                            : 'bg-blue-500/20 text-blue-400'
                        }`}
                      >
                        {file.status}
                      </span>
                      <span className="truncate">{file.path}</span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[10px] text-emerald-400">+{file.insertions}</span>
                      <span className="text-[10px] text-rose-400">-{file.deletions}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenNativeDiff(file.path);
                        }}
                        className="p-0.5 rounded hover:bg-vscode-hover text-gray-400 hover:text-white"
                        title="Open in VS Code Native Diff Editor"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Diff Content View */}
          <div className="flex-1 flex flex-col rounded-xl border border-vscode-border bg-vscode-sidebar/30 overflow-hidden">
            <div className="p-3 border-b border-vscode-border bg-vscode-sidebar/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs text-gray-200 font-mono truncate max-w-md">
                  {selectedFile ? `File: ${selectedFile}` : 'Complete Comparison Diff (All Files)'}
                </span>
                {selectedFile && (
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="text-[11px] text-blue-400 hover:text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20"
                  >
                    ✕ Show All Files
                  </button>
                )}
              </div>

              {selectedFile && (
                <button
                  onClick={() => handleOpenNativeDiff(selectedFile)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition shadow-sm"
                  title="Open VS Code native diff editor"
                >
                  <span>Open in VS Code Diff</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="flex-1 overflow-auto p-2">
              <DiffViewer diff={activeDiff} fileName={selectedFile || undefined} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
