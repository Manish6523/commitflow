import React, { useEffect, useState } from 'react';
import { AlertTriangle, FileCode2, Settings, Sparkles } from 'lucide-react';
import { useCommitStore } from '../stores/useCommitStore';
import { CommitDetails } from '../types';
import { vscode } from '../vscode';
import { EmptyState } from './ui/EmptyState';
import { ghostButton } from './ui/styles';

export const AiInsightsPanel: React.FC<{ commit: CommitDetails }> = ({ commit }) => {
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const setViewMode = useCommitStore((state) => state.setViewMode);

  useEffect(() => {
    let cancelled = false;
    vscode
      .request<{ result?: any }>({ type: 'AI_ACTION', action: 'summarize', payload: { commit } }, 200000)
      .then((res) => {
        if (!cancelled) setAnalysis(res?.result ?? null);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [commit.hash]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-purple-500">
        <Sparkles className="w-8 h-8 animate-pulse" />
        <span className="text-xs">Analyzing this commit. Large commits can take a minute or two.</span>
      </div>
    );
  }

  if (failed || !analysis) {
    return (
      <EmptyState
        icon={<Sparkles className="w-7 h-7" />}
        title="Couldn’t analyze this commit"
        detail="Open the commit again to retry."
      />
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 space-y-4 max-w-3xl mx-auto animate-in fade-in duration-200">
        {analysis.warning && (
          <div role="alert" className="flex items-start gap-2 p-2.5 rounded-md bg-amber-500/10 text-xs text-gray-200">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-px" />
            <span>{analysis.warning}</span>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 text-[11px] text-gray-400">
          {analysis.source === 'ai' ? (
            <span>Analyzed by {analysis.model}</span>
          ) : (
            <span>Basic built-in analysis. Add an API key for a real AI review.</span>
          )}
          {analysis.source !== 'ai' && (
            <button onClick={() => setViewMode('settings')} className={ghostButton}>
              <Settings className="w-3 h-3" />
              Set up AI
            </button>
          )}
        </div>

        <div className="p-4 rounded-xl border border-purple-500/20 bg-purple-500/5">
          <h4 className="font-semibold text-xs text-purple-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" />
            Commit Summary & Purpose
          </h4>
          <p className="text-xs text-gray-200 leading-relaxed select-text">{analysis.summary}</p>
        </div>

        <div className="p-4 rounded-xl border border-vscode-border bg-vscode-sidebar/40 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-xs text-gray-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Risk Level Assessment
            </h4>
            <span
              className={`px-2 py-0.5 rounded text-xs font-bold ${
                analysis.riskLevel === 'High'
                  ? 'bg-rose-500/20 text-rose-500 border border-rose-500/30'
                  : analysis.riskLevel === 'Medium'
                  ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30'
                  : 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30'
              }`}
            >
              {analysis.riskLevel} Risk
            </span>
          </div>
          <ul className="list-disc list-inside text-xs text-gray-400 space-y-1 pt-1">
            {analysis.riskFactors.map((factor: string, index: number) => (
              <li key={index}>{factor}</li>
            ))}
          </ul>
        </div>

        <div className="p-4 rounded-xl border border-vscode-border bg-vscode-sidebar/40 space-y-2">
          <h4 className="font-semibold text-xs text-gray-200 flex items-center gap-2">
            <FileCode2 className="w-4 h-4 text-blue-500" />
            Key Architectural Changes
          </h4>
          <ul className="text-xs font-mono text-gray-300 space-y-1">
            {analysis.keyChanges.map((change: string, index: number) => (
              <li key={index} className="p-1 rounded bg-vscode-input/50">
                {change}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
