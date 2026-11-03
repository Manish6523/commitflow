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
    const prompt = window.prompt(
      'Describe what commits you are searching for in natural language:\n(e.g. "commits by alex last week fixing auth")'
    );
    if (!prompt) return;

    setAiSearching(true);
    try {
      const res = await vscode.request<{ result?: { query: string } }>({
        type: 'AI_ACTION',
        action: 'nl_search',
        payload: { prompt },
      });
      if (res?.result?.query) {
        setSearchQuery(res.result.query);
      }
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

  return (
    <div className="bg-vscode-bg border-b border-vscode-border p-3 flex flex-col gap-2.5 shrink-0">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search input with operator autocompletion */}
        <div className="relative flex-1 min-w-[260px]">
          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-gray-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setShowAutocomplete(true)}
            placeholder="Search commits... (e.g. author:manish after:2026-10-01 is:merge)"
            className="w-full pl-8 pr-16 py-1.5 bg-vscode-input text-vscode-fg border border-vscode-inputBorder rounded-md text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-500"
          />

          <div className="absolute inset-y-0 right-1 flex items-center gap-1">
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="p-1 text-gray-400 hover:text-gray-200 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => setShowAutocomplete(!showAutocomplete)}
              title="Search Operators Syntax"
              className="p-1 text-gray-400 hover:text-blue-400 rounded text-[11px] font-mono px-1.5 bg-vscode-sidebar border border-vscode-border"
            >
              ops
            </button>
          </div>

          {/* Operators Autocomplete Dropdown */}
          {showAutocomplete && (
            <div
              className="absolute left-0 right-0 top-full mt-1 bg-vscode-sidebar border border-vscode-border rounded-lg shadow-xl z-50 p-1.5 flex flex-col gap-1 max-h-64 overflow-y-auto"
              onMouseLeave={() => setShowAutocomplete(false)}
            >
              <div className="text-[11px] text-gray-400 font-semibold px-2 py-1 flex justify-between items-center border-b border-vscode-border">
                <span>Search Operators</span>
                <span className="text-[10px] text-gray-500">Click to append</span>
              </div>
              {operators.map((op) => (
                <button
                  key={op.label}
                  onClick={() => handleOperatorClick(op.label)}
                  className="text-left px-2 py-1.5 rounded hover:bg-vscode-hover text-xs flex items-center justify-between group transition"
                >
                  <span className="font-mono text-blue-400 group-hover:text-blue-300 font-semibold">
                    {op.label}
                  </span>
                  <span className="text-gray-400 text-[11px]">{op.desc}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* AI Natural Language Search Button */}
        <button
          onClick={handleAiNaturalLanguageSearch}
          disabled={aiSearching}
          title="Search commits with natural language"
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-md text-xs font-medium transition"
        >
          <Sparkles className={`w-3.5 h-3.5 ${aiSearching ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Smart Search</span>
        </button>

        {/* Date Presets Dropdown */}
        <div className="flex items-center gap-1 bg-vscode-input rounded-md border border-vscode-inputBorder px-1.5 py-1 text-xs">
          <Calendar className="w-3.5 h-3.5 text-gray-400" />
          <select
            value={filters.since ? 'custom' : 'all'}
            onChange={(e) => handleDatePreset(e.target.value)}
            className="bg-transparent text-vscode-fg text-xs focus:outline-none cursor-pointer"
          >
            <option value="all">All Dates</option>
            <option value="today">Today</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
        </div>

        {/* Merge commits filter */}
        <div className="flex items-center gap-1 bg-vscode-input rounded-md border border-vscode-inputBorder px-1.5 py-1 text-xs">
          <GitMerge className="w-3.5 h-3.5 text-gray-400" />
          <select
            value={
              filters.isMerge === true
                ? 'merges'
                : filters.isMerge === false
                ? 'no-merges'
                : 'all'
            }
            onChange={(e) => {
              const val = e.target.value;
              setFilters({
                isMerge: val === 'merges' ? true : val === 'no-merges' ? false : undefined,
              });
            }}
            className="bg-transparent text-vscode-fg text-xs focus:outline-none cursor-pointer"
          >
            <option value="all">All Commits</option>
            <option value="merges">Merges Only</option>
            <option value="no-merges">Non-Merges</option>
          </select>
        </div>

        {/* Saved Filters Selector */}
        {savedFilters.length > 0 && (
          <div className="flex items-center gap-1 bg-vscode-input rounded-md border border-vscode-inputBorder px-1.5 py-1 text-xs">
            <Bookmark className="w-3.5 h-3.5 text-blue-400" />
            <select
              onChange={(e) => {
                const found = savedFilters.find((f) => f.id === e.target.value);
                if (found) {
                  setSearchQuery(found.query);
                  setFilters(found.filterOptions);
                }
              }}
              className="bg-transparent text-vscode-fg text-xs focus:outline-none cursor-pointer max-w-[130px]"
            >
              <option value="">Saved Views</option>
              {savedFilters.map((sf) => (
                <option key={sf.id} value={sf.id}>
                  {sf.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Save Current Filter */}
        <button
          onClick={() => setShowSaveModal(true)}
          title="Save this search and filter view"
          className="p-1.5 rounded-md hover:bg-vscode-hover text-gray-300 hover:text-white border border-vscode-border transition"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>

        {/* Clear filters if any active */}
        {(activeFilterCount > 0 || searchQuery) && (
          <button
            onClick={clearFilters}
            className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10 border border-red-500/20 transition flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>

      {/* Active Filter Badges */}
      <div className="flex items-center justify-between text-xs text-gray-400 flex-wrap gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-gray-300">
            {totalCount.toLocaleString()} commit{totalCount === 1 ? '' : 's'}
          </span>

          {filters.since && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 text-[11px]">
              Since: {filters.since}
              <button onClick={() => setFilters({ since: undefined })}>
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {filters.until && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 text-[11px]">
              Until: {filters.until}
              <button onClick={() => setFilters({ until: undefined })}>
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {filters.isMerge !== undefined && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/30 text-[11px]">
              {filters.isMerge ? 'Merges Only' : 'Excluding Merges'}
              <button onClick={() => setFilters({ isMerge: undefined })}>
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {filters.filePath && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[11px] font-mono">
              File: {filters.filePath}
              <button onClick={() => setFilters({ filePath: undefined })}>
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>
      </div>

      {/* Save Filter Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-vscode-sidebar border border-vscode-border rounded-xl p-4 max-w-sm w-full shadow-2xl flex flex-col gap-3">
            <h3 className="font-semibold text-sm text-gray-100 flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-blue-400" />
              Save Current Filter
            </h3>
            <p className="text-xs text-gray-400">
              Save your current search query and active parameters for quick access.
            </p>
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="e.g. Auth Changes Last Month"
              className="bg-vscode-input text-vscode-fg border border-vscode-inputBorder rounded px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-3 py-1 text-xs text-gray-400 hover:text-white rounded hover:bg-vscode-hover"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (saveName.trim()) {
                    saveCurrentFilter(saveName.trim());
                    setShowSaveModal(false);
                    setSaveName('');
                  }
                }}
                disabled={!saveName.trim()}
                className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded font-medium disabled:opacity-50"
              >
                Save Filter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
