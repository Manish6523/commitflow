import React, { useState, useRef } from 'react';
import { useCommitStore } from '../stores/useCommitStore';
import {
  Search,
  X,
  Bookmark,
  Calendar,
  GitMerge,
  Sparkles,
  Plus,
  Trash2,
} from 'lucide-react';
import { vscode } from '../vscode';
import { Dialog, DialogButtons } from './ui/Dialog';
import { ghostButton, iconButton, inlineSelect, textInput } from './ui/styles';

const FilterChip: React.FC<{ label: string; onRemove: () => void }> = ({ label, onRemove }) => (
  <span className="inline-flex items-center gap-1 pl-1.5 pr-0.5 rounded bg-blue-500/15 text-blue-500 text-[11px] animate-in fade-in duration-150">
    <span className="truncate max-w-[220px]">{label}</span>
    <button onClick={onRemove} className="p-0.5 rounded hover:bg-vscode-hover" aria-label={`Remove ${label}`}>
      <X className="w-3 h-3" />
    </button>
  </span>
);

export const SearchBar: React.FC = () => {
  const {
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
    clearFilters,
    savedFilters,
    saveCurrentFilter,
    totalCount,
  } = useCommitStore();

  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [aiSearching, setAiSearching] = useState(false);
  const [showAiDialog, setShowAiDialog] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const operators = [
    { label: 'author:', desc: 'Filter by author name (e.g. author:manish)' },
    { label: 'message:', desc: 'Search commit message body (e.g. message:feat)' },
    { label: 'after:', desc: 'Commits after date (e.g. after:2026-10-01)' },
    { label: 'before:', desc: 'Commits before date (e.g. before:2026-11-01)' },
    { label: 'file:', desc: 'Commits modifying file path (e.g. file:src/index.ts)' },
    { label: 'is:merge', desc: 'Show only merge commits' },
    { label: 'hash:', desc: 'Find specific commit hash' },
  ];

  const handleOperatorClick = (op: string) => {
    const newQuery = searchQuery ? `${searchQuery.trim()} ${op}` : op;
    setSearchQuery(newQuery);
    setShowAutocomplete(false);
    inputRef.current?.focus();
  };

  const handleDatePreset = (preset: string) => {
    const now = new Date();
    let since = '';

    if (preset === 'today') {
      since = now.toISOString().split('T')[0];
    } else if (preset === '7d') {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      since = d.toISOString().split('T')[0];
    } else if (preset === '30d') {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      since = d.toISOString().split('T')[0];
    } else if (preset === '90d') {
      const d = new Date(now);
      d.setDate(d.getDate() - 90);
      since = d.toISOString().split('T')[0];
    }

    setFilters({ since: since || undefined });
  };

  const handleAiNaturalLanguageSearch = async () => {
    const prompt = aiPrompt.trim();
    if (!prompt) return;

    setShowAiDialog(false);
    setAiPrompt('');
    setAiSearching(true);
    try {
      const res = await vscode.request<{ result?: { query: string } }>(
        { type: 'AI_ACTION', action: 'nl_search', payload: { prompt } },
        120000
      );
      if (res?.result?.query) {
        setSearchQuery(res.result.query);
      }
    } catch {
      // The extension reports failures through the toast.
    } finally {
      setAiSearching(false);
    }
  };

  const activeFilterCount =
    (filters.since ? 1 : 0) +
    (filters.until ? 1 : 0) +
    (filters.authors?.length || 0) +
    (filters.isMerge !== undefined ? 1 : 0) +
    (filters.filePath ? 1 : 0);

  const hasChips = Boolean(filters.since || filters.until || filters.filePath) || filters.isMerge !== undefined;

  const closeSaveDialog = () => {
    setShowSaveModal(false);
    setSaveName('');
  };

  const saveFilter = () => {
    if (saveName.trim()) {
      saveCurrentFilter(saveName.trim());
      closeSaveDialog();
    }
  };

  return (
    <div className="px-3 py-1.5 border-b border-vscode-border bg-vscode-sidebar/60 flex flex-col gap-1.5 shrink-0">
      <div className="flex items-center gap-1 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setShowAutocomplete(true)}
            onKeyDown={(e) => e.key === 'Escape' && setShowAutocomplete(false)}
            placeholder="Search commits, or try author:ada after:2026-10-01 is:merge"
            aria-label="Search commits"
            className={`${textInput} pl-6 pr-14`}
          />

          <div className="absolute inset-y-0 right-1 flex items-center gap-0.5">
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="p-0.5 rounded text-gray-400 hover:text-vscode-fg"
                aria-label="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
            <button
              onClick={() => setShowAutocomplete(!showAutocomplete)}
              title="Search operators"
              className="px-1 rounded text-[10px] font-mono text-gray-400 hover:text-vscode-fg hover:bg-vscode-hover transition-colors"
            >
              ops
            </button>
          </div>

          {showAutocomplete && (
            <div
              className="absolute left-0 right-0 top-full mt-1 z-40 p-1 max-h-64 overflow-y-auto rounded-xl border border-vscode-border bg-vscode-sidebar shadow-xl animate-in fade-in slide-in-from-top-1 duration-150"
              onMouseLeave={() => setShowAutocomplete(false)}
            >
              {operators.map((op) => (
                <button
                  key={op.label}
                  onClick={() => handleOperatorClick(op.label)}
                  className="w-full flex items-center justify-between gap-3 px-2 py-1 rounded-md text-left text-xs hover:bg-vscode-hover transition-colors"
                >
                  <span className="font-mono font-medium text-blue-500">{op.label}</span>
                  <span className="text-[11px] text-gray-400 truncate">{op.desc}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => setShowAiDialog(true)}
          disabled={aiSearching}
          title="Search commits with natural language"
          className={ghostButton}
        >
          <Sparkles className={`w-3.5 h-3.5 text-purple-500 ${aiSearching ? 'animate-pulse' : ''}`} />
          <span className="hidden sm:inline">Smart Search</span>
        </button>

        <label className={inlineSelect}>
          <Calendar className="w-3.5 h-3.5 text-gray-400" />
          <select
            value={filters.since ? 'custom' : 'all'}
            onChange={(e) => handleDatePreset(e.target.value)}
            aria-label="Date range"
            className="bg-transparent text-xs focus:outline-none cursor-pointer"
          >
            <option value="all">All Dates</option>
            {filters.since && <option value="custom">Custom</option>}
            <option value="today">Today</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
        </label>

        <label className={inlineSelect}>
          <GitMerge className="w-3.5 h-3.5 text-gray-400" />
          <select
            value={filters.isMerge === true ? 'merges' : filters.isMerge === false ? 'no-merges' : 'all'}
            onChange={(e) => {
              const val = e.target.value;
              setFilters({ isMerge: val === 'merges' ? true : val === 'no-merges' ? false : undefined });
            }}
            aria-label="Merge commits"
            className="bg-transparent text-xs focus:outline-none cursor-pointer"
          >
            <option value="all">All Commits</option>
            <option value="merges">Merges Only</option>
            <option value="no-merges">Non-Merges</option>
          </select>
        </label>

        {savedFilters.length > 0 && (
          <label className={inlineSelect}>
            <Bookmark className="w-3.5 h-3.5 text-gray-400" />
            <select
              value=""
              onChange={(e) => {
                const found = savedFilters.find((f) => f.id === e.target.value);
                if (found) {
                  setSearchQuery(found.query);
                  setFilters(found.filterOptions);
                }
              }}
              aria-label="Saved views"
              className="bg-transparent text-xs focus:outline-none cursor-pointer max-w-[130px]"
            >
              <option value="">Saved Views</option>
              {savedFilters.map((sf) => (
                <option key={sf.id} value={sf.id}>
                  {sf.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <button
          onClick={() => setShowSaveModal(true)}
          title="Save this search"
          aria-label="Save this search"
          className={iconButton}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>

        {(activeFilterCount > 0 || searchQuery) && (
          <button onClick={clearFilters} className={ghostButton}>
            <Trash2 className="w-3 h-3" />
            Clear
          </button>
        )}

        <span className="text-[11px] text-gray-400 tabular-nums px-1">
          {totalCount.toLocaleString()} commit{totalCount === 1 ? '' : 's'}
        </span>
      </div>

      {hasChips && (
        <div className="flex items-center gap-1 flex-wrap">
          {filters.since && (
            <FilterChip label={`Since ${filters.since}`} onRemove={() => setFilters({ since: undefined })} />
          )}
          {filters.until && (
            <FilterChip label={`Until ${filters.until}`} onRemove={() => setFilters({ until: undefined })} />
          )}
          {filters.isMerge !== undefined && (
            <FilterChip
              label={filters.isMerge ? 'Merges only' : 'Excluding merges'}
              onRemove={() => setFilters({ isMerge: undefined })}
            />
          )}
          {filters.filePath && (
            <FilterChip label={filters.filePath} onRemove={() => setFilters({ filePath: undefined })} />
          )}
        </div>
      )}

      {showSaveModal && (
        <Dialog
          title="Save this search"
          icon={<Bookmark className="w-4 h-4 text-blue-500" />}
          onClose={closeSaveDialog}
        >
          <input
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveFilter()}
            placeholder="Auth changes last month"
            aria-label="View name"
            className={textInput}
            autoFocus
          />
          <DialogButtons
            onCancel={closeSaveDialog}
            onConfirm={saveFilter}
            label="Save"
            disabled={!saveName.trim()}
          />
        </Dialog>
      )}

      {showAiDialog && (
        <Dialog
          title="Smart Search"
          icon={<Sparkles className="w-4 h-4 text-purple-500" />}
          onClose={() => setShowAiDialog(false)}
        >
          <input
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAiNaturalLanguageSearch()}
            placeholder="commits by alex last week fixing auth"
            aria-label="Describe the commits you want"
            className={textInput}
            autoFocus
          />
          <DialogButtons
            onCancel={() => setShowAiDialog(false)}
            onConfirm={handleAiNaturalLanguageSearch}
            label="Search"
            disabled={!aiPrompt.trim()}
          />
        </Dialog>
      )}
    </div>
  );
};
