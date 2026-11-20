import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, GitBranch, Cloud, Star, Tag as TagIcon } from 'lucide-react';
import { CompareSuggestions, GitCommit } from '../../types';
import { vscode } from '../../vscode';
import { timeAgo } from '../../utils/fileHistory';

type Item =
  | { kind: 'commit'; group: 'starred' | 'commits'; commit: GitCommit }
  | { kind: 'ref'; ref: CompareSuggestions['refs'][number] };

const GROUP_TITLES = { starred: '★ Starred', refs: 'Branches & Tags', commits: 'Commits' } as const;

/** Mark the part of a text that matches what was typed. */
const Highlight: React.FC<{ text: string; query: string }> = ({ text, query }) => {
  const q = query.trim();
  const at = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (at === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="bg-amber-400/30 text-inherit rounded-sm">{text.slice(at, at + q.length)}</mark>
      {text.slice(at + q.length)}
    </>
  );
};

/**
 * A box for a commit, branch or tag. Type anything git understands, or open
 * the list to pick from starred commits, branches, tags and matching commits.
 */
export const RefPicker: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  /** The message of the commit this resolved to, shown under the box. */
  summary?: string;
  placeholder: string;
}> = ({ label, value, onChange, onSubmit, summary, placeholder }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<CompareSuggestions | null>(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  // Enter picks from the list once someone types or moves through it; otherwise it compares.
  const [browsing, setBrowsing] = useState(false);
  const latest = useRef('');
  const listRef = useRef<HTMLDivElement>(null);

  // Ask for suggestions as the query settles; ignore replies to older queries.
  useEffect(() => {
    if (!open) return;
    latest.current = query;
    setLoading(true);
    const timer = setTimeout(() => {
      vscode
        .request<{ query: string; suggestions: CompareSuggestions }>({ type: 'COMPARE_SUGGEST', query })
        .then((res) => {
          if (res.query !== latest.current) return;
          setSuggestions(res.suggestions);
          setActive(0);
        })
        .catch(() => latest.current === query && setSuggestions({ starred: [], refs: [], commits: [] }))
        .finally(() => latest.current === query && setLoading(false));
    }, 150);
    return () => clearTimeout(timer);
  }, [open, query]);

  const items = useMemo<Item[]>(() => {
    if (!suggestions) return [];
    const starred = new Set(suggestions.starred.map((c) => c.hash));
    return [
      ...suggestions.starred.map((commit) => ({ kind: 'commit' as const, group: 'starred' as const, commit })),
      ...suggestions.refs.map((ref) => ({ kind: 'ref' as const, ref })),
      ...suggestions.commits
        .filter((c) => !starred.has(c.hash))
        .map((commit) => ({ kind: 'commit' as const, group: 'commits' as const, commit })),
    ];
  }, [suggestions]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const pick = (item: Item) => {
    onChange(item.kind === 'ref' ? item.ref.name : item.commit.shortHash);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setBrowsing(true);
      if (!open) return setOpen(true);
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (items.length ? (i + step + items.length) % items.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && items[active] && (query || browsing)) pick(items[active]);
      else {
        setOpen(false);
        onSubmit();
      }
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  const groupOf = (item: Item) => (item.kind === 'ref' ? 'refs' : item.group);

  return (
    <div className="relative flex-1 min-w-[200px]">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-gray-400 font-medium shrink-0">{label}:</span>
        <div className="relative flex-1">
          <input
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
            aria-label={label}
            value={value}
            placeholder={placeholder}
            spellCheck={false}
            onChange={(e) => {
              onChange(e.target.value);
              setQuery(e.target.value);
              setBrowsing(true);
              setOpen(true);
            }}
            onFocus={() => {
              setQuery('');
              setBrowsing(false);
              setOpen(true);
            }}
            onClick={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={onKeyDown}
            className="w-full h-7 pl-2 pr-7 rounded border border-vscode-border bg-vscode-input text-xs font-mono text-vscode-fg focus:outline-none focus:border-blue-500"
          />
          <ChevronDown
            className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            aria-hidden="true"
          />
        </div>
      </div>
      {summary && !open && (
        <div className="mt-1 ml-12 text-[11px] text-gray-400 truncate" title={summary}>
          {summary}
        </div>
      )}

      {open && (
        <div
          ref={listRef}
          role="listbox"
          // Keep focus in the box while clicking the list.
          onMouseDown={(e) => e.preventDefault()}
          className="absolute z-50 left-12 right-0 top-8 max-h-80 overflow-y-auto rounded-md border border-vscode-border shadow-xl py-1"
          style={{ background: 'var(--vscode-editorWidget-background, var(--vscode-sideBar-background, #252526))' }}
        >
          {loading && !suggestions && <div className="px-3 py-2 text-xs text-gray-400">Loading…</div>}
          {suggestions && items.length === 0 && (
            <div className="px-3 py-2 text-xs text-gray-400">
              Nothing matches. Press Enter to compare “{value}” anyway.
            </div>
          )}
          {items.map((item, index) => {
            const group = groupOf(item);
            const first = index === 0 || groupOf(items[index - 1]) !== group;
            const selected = index === active;
            return (
              <React.Fragment key={item.kind === 'ref' ? `ref:${item.ref.kind}:${item.ref.name}` : `${item.group}:${item.commit.hash}`}>
                {first && (
                  <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    {GROUP_TITLES[group]}
                  </div>
                )}
                <div
                  role="option"
                  aria-selected={selected}
                  data-index={index}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => pick(item)}
                  className={`flex items-center gap-2 px-3 py-1 text-xs cursor-pointer ${
                    selected ? 'bg-vscode-active text-vscode-activeFg' : 'text-gray-200'
                  }`}
                >
                  {item.kind === 'ref' ? (
                    <>
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 rounded-full font-mono text-[11px] truncate ${
                          item.ref.kind === 'tag' ? 'bg-amber-500/15 text-amber-500' : 'bg-blue-500/15 text-blue-400'
                        }`}
                      >
                        {item.ref.kind === 'tag' ? (
                          <TagIcon className="w-3 h-3" />
                        ) : item.ref.kind === 'remote' ? (
                          <Cloud className="w-3 h-3" />
                        ) : (
                          <GitBranch className="w-3 h-3" />
                        )}
                        <Highlight text={item.ref.name} query={query} />
                      </span>
                      <span className="flex-1" />
                      <span className="text-[11px] opacity-70 shrink-0">
                        {item.ref.kind === 'tag' ? 'tag' : item.ref.kind === 'remote' ? 'remote branch' : 'branch'}
                        {item.ref.date && !Number.isNaN(Date.parse(item.ref.date)) ? ` · ${timeAgo(Date.parse(item.ref.date))}` : ''}
                      </span>
                    </>
                  ) : (
                    <>
                      {item.group === 'starred' && <Star className="w-3 h-3 shrink-0 fill-amber-400 text-amber-400" />}
                      <span className="font-mono text-blue-400 shrink-0 w-14">
                        <Highlight text={item.commit.shortHash} query={query} />
                      </span>
                      <span className="flex-1 min-w-0 truncate">
                        <Highlight text={item.commit.subject} query={query} />
                      </span>
                      <span className="text-[11px] opacity-70 shrink-0 hidden sm:inline">
                        {item.commit.author.name} · {timeAgo(item.commit.author.timestamp)}
                      </span>
                    </>
                  )}
                </div>
              </React.Fragment>
            );
          })}
          <div className="mt-1 px-3 pt-1.5 pb-0.5 border-t border-vscode-border text-[10px] text-gray-500">
            ↑ ↓ move · Enter pick · Esc close · or type an ID, branch, tag or HEAD~1
          </div>
        </div>
      )}
    </div>
  );
};
