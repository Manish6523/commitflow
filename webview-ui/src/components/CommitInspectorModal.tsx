import React, { useState, useMemo } from 'react';
import { useCommitStore } from '../stores/useCommitStore';
import {
  X,
  Copy,
  Check,
  GitMerge,
  ShieldCheck,
  Sparkles,
  ExternalLink,
  GitCommit,
  User,
  AlertTriangle,
  FileCode2,
} from 'lucide-react';
import { DiffViewer } from './DiffViewer';
import { extractFileDiff } from '../utils/diff';
import { vscode } from '../vscode';

export const CommitInspectorModal: React.FC = () => {
  const {
    selectedCommitDetails,
    selectCommit,
    loadingDetails,
  } = useCommitStore();

  const [activeTab, setActiveTab] = useState<'diff' | 'ai'>('diff');
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [copiedSha, setCopiedSha] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  const commit = selectedCommitDetails;

  const copySha = () => {
    if (commit) {
      vscode.postMessage({ type: 'COPY_TO_CLIPBOARD', text: commit.hash });
      setCopiedSha(true);
      setTimeout(() => setCopiedSha(false), 2000);
    }
  };

  const handleOpenEditor = (filePath: string) => {
    vscode.postMessage({ type: 'OPEN_IN_EDITOR', filePath });
  };

  const handleOpenDiffEditor = (filePath: string) => {
    if (commit) {
      vscode.postMessage({
        type: 'OPEN_DIFF_EDITOR',
        baseHash: commit.parentHashes[0] || 'HEAD~1',
        targetHash: commit.hash,
        filePath,
      });
    }
  };

  const handleRequestAiSummary = async () => {
    if (!commit) return;
    setLoadingAi(true);
    try {
      const res = await vscode.request<{ result?: any }>({
        type: 'AI_ACTION',
        action: 'summarize',
        payload: { commit },
      });
      if (res?.result) {
        setAiAnalysis(res.result);
      }
    } finally {
      setLoadingAi(false);
    }
  };

  // Toggle file selection: clicking the selected file deselects it back to all files
  const toggleFile = (path: string) => {
    setSelectedFilePath((prev) => (prev === path ? null : path));
  };

  // Filter diff for selected file or show complete diff
  const activeDiff = useMemo(() => {
    if (!commit?.diff) return '';
    if (selectedFilePath) {
      return extractFileDiff(commit.diff, selectedFilePath);
    }
    return commit.diff;
  }, [commit?.diff, selectedFilePath]);

  if (!selectedCommitDetails && !loadingDetails) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 md:p-6 select-none">
      <div className="bg-vscode-bg border border-vscode-border rounded-2xl w-full max-w-5xl h-[90vh] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Top Header */}
        <div className="px-5 py-3 border-b border-vscode-border bg-vscode-sidebar/90 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
              <GitCommit className="w-5 h-5" />
            </div>
            <div className="flex flex-col overflow-hidden">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-gray-100 truncate">
                  {commit?.subject || 'Loading commit details...'}
                </span>
              </div>
              {commit && (
                <div className="flex items-center gap-2 text-xs font-mono text-gray-400 mt-0.5">
                  <button
                    onClick={copySha}
                    className="flex items-center gap-1 text-blue-400 hover:text-blue-300 font-bold"
                    title="Click to copy full SHA"
                  >
                    {copiedSha ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{commit.shortHash}</span>
                  </button>
                  <span>·</span>
                  <span>{new Date(commit.author.timestamp).toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* AI Summary Tab Button */}
            <button
              onClick={() => {
                setActiveTab(activeTab === 'ai' ? 'diff' : 'ai');
                if (!aiAnalysis) handleRequestAiSummary();
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border transition ${
                activeTab === 'ai'
                  ? 'bg-purple-600 text-white border-purple-500 shadow'
                  : 'bg-purple-500/10 text-purple-300 border-purple-500/30 hover:bg-purple-500/20'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Insights</span>
            </button>

            <button
              onClick={() => selectCommit(null)}
              className="p-1.5 rounded-lg hover:bg-vscode-hover text-gray-400 hover:text-white transition"
              title="Close Inspector"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        {commit ? (
          <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
            {/* Left Column: Metadata & File List */}
            <div className="w-full md:w-80 border-r border-vscode-border bg-vscode-sidebar/30 flex flex-col overflow-hidden shrink-0">
              {/* Commit Details Box */}
              <div className="p-4 border-b border-vscode-border space-y-3 overflow-y-auto max-h-52">
                <div>
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                    Full Commit Message
                  </span>
                  <p className="text-xs text-gray-200 font-sans whitespace-pre-wrap leading-relaxed select-text">
                    {commit.subject}
                    {commit.body ? `\n\n${commit.body}` : ''}
                  </p>
                </div>

                <div className="pt-2 border-t border-vscode-border/60 text-xs space-y-1.5">
                  <div className="flex items-center gap-2 text-gray-300">
                    <User className="w-3.5 h-3.5 text-gray-400" />
                    <span className="font-medium">{commit.author.name}</span>
                    <span className="text-[11px] text-gray-500 font-mono">&lt;{commit.author.email}&gt;</span>
                  </div>

                  {commit.parentHashes.length > 0 && (
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                      <span className="font-semibold">Parents:</span>
                      {commit.parentHashes.map((p) => (
                        <button
                          key={p}
                          onClick={() => {
                            setSelectedFilePath(null);
                            selectCommit(p);
                          }}
                          className="font-mono text-blue-400 hover:underline"
                        >
                          {p.substring(0, 7)}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Badges */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    {commit.isMerge && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        <GitMerge className="w-3 h-3" />
                        Merge Commit
                      </span>
                    )}
                    {commit.signatureStatus === 'G' && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        <ShieldCheck className="w-3 h-3" />
                        Verified
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Changed Files Header with "All Files" Toggle */}
              <div className="px-3 py-2 border-b border-vscode-border bg-vscode-sidebar/80 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-200">
                    Files ({commit.files?.length || commit.filesChanged})
                  </span>
                  <button
                    onClick={() => setSelectedFilePath(null)}
                    className={`px-2 py-0.5 rounded text-[11px] transition ${
                      selectedFilePath === null
                        ? 'bg-blue-600 text-white font-medium shadow-sm'
                        : 'text-gray-400 hover:text-white hover:bg-vscode-hover'
                    }`}
                    title="Show all files combined diff"
                  >
                    All
                  </button>
                </div>

                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <span className="text-emerald-400 font-medium">+{commit.insertions}</span>
                  <span className="text-rose-400 font-medium">-{commit.deletions}</span>
                </div>
              </div>

              {/* Interactive Files List with Instant Toggle */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {commit.files && commit.files.length > 0 ? (
                  commit.files.map((file) => {
                    const isSelected = selectedFilePath === file.path;
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

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] text-emerald-400">+{file.insertions}</span>
                          <span className="text-[10px] text-rose-400">-{file.deletions}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditor(file.path);
                            }}
                            className="p-1 rounded hover:bg-vscode-hover text-gray-400 hover:text-white"
                            title="Open file in VS Code editor"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-4 text-center text-xs text-gray-500">
                    No individual file modifications listed.
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Diff Viewer or AI Insights */}
            <div className="flex-1 flex flex-col overflow-hidden bg-vscode-bg p-3">
              {activeTab === 'diff' ? (
                <div className="flex-1 flex flex-col h-full overflow-hidden">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-vscode-border">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-gray-300 font-semibold truncate max-w-md">
                        {selectedFilePath ? `File: ${selectedFilePath}` : 'Complete Commit Diff (All Files)'}
                      </span>
                      {selectedFilePath && (
                        <button
                          onClick={() => setSelectedFilePath(null)}
                          className="text-[11px] text-blue-400 hover:text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20"
                        >
                          ✕ Show All Files
                        </button>
                      )}
                    </div>

                    {selectedFilePath && (
                      <button
                        onClick={() => handleOpenDiffEditor(selectedFilePath)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition shadow-sm"
                        title="Open VS Code native diff editor"
                      >
                        <span>Open Native Diff</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <div className="flex-1 overflow-hidden">
                    <DiffViewer diff={activeDiff} fileName={selectedFilePath || undefined} />
                  </div>
                </div>
              ) : (
                /* AI Insights Tab */
                <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-3xl">
                  {loadingAi ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-purple-300">
                      <Sparkles className="w-8 h-8 animate-spin" />
                      <span className="text-xs">Analyzing commit impact and security risk...</span>
                    </div>
                  ) : aiAnalysis ? (
                    <div className="space-y-4 animate-in fade-in">
                      {/* Summary */}
                      <div className="p-4 rounded-xl border border-purple-500/20 bg-purple-500/5">
                        <h4 className="font-semibold text-xs text-purple-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4" />
                          Commit Summary & Purpose
                        </h4>
                        <p className="text-xs text-gray-200 leading-relaxed font-sans">
                          {aiAnalysis.summary}
                        </p>
                      </div>

                      {/* Risk Assessment */}
                      <div className="p-4 rounded-xl border border-vscode-border bg-vscode-sidebar/40 space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-xs text-gray-200 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-400" />
                            Risk Level Assessment
                          </h4>
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-bold ${
                              aiAnalysis.riskLevel === 'High'
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                : aiAnalysis.riskLevel === 'Medium'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            }`}
                          >
                            {aiAnalysis.riskLevel} Risk
                          </span>
                        </div>
                        <ul className="list-disc list-inside text-xs text-gray-400 space-y-1 pt-1 font-sans">
                          {aiAnalysis.riskFactors.map((rf: string, idx: number) => (
                            <li key={idx}>{rf}</li>
                          ))}
                        </ul>
                      </div>

                      {/* Key File Highlights */}
                      <div className="p-4 rounded-xl border border-vscode-border bg-vscode-sidebar/40 space-y-2">
                        <h4 className="font-semibold text-xs text-gray-200 flex items-center gap-2">
                          <FileCode2 className="w-4 h-4 text-blue-400" />
                          Key Architectural Changes
                        </h4>
                        <ul className="text-xs font-mono text-gray-300 space-y-1">
                          {aiAnalysis.keyChanges.map((kc: string, idx: number) => (
                            <li key={idx} className="p-1 rounded bg-vscode-input/50">
                              {kc}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 text-xs">
            Loading commit details...
          </div>
        )}
      </div>
    </div>
  );
};
