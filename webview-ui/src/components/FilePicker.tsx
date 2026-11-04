import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Search } from 'lucide-react';
import { filterFiles } from '../utils/fileHistory';

interface FilePickerProps {
  files: string[] | null;
  onSelect: (filePath: string) => void;
  onCancel?: () => void;
  autoFocus?: boolean;
}

const MAX_RESULTS = 100;

export const FilePicker: React.FC<FilePickerProps> = ({ files, onSelect, onCancel, autoFocus }) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => filterFiles(files ?? [], query, MAX_RESULTS), [files, query]);

  useEffect(() => setActiveIndex(0), [query]);

  useEffect(() => {
    listRef.current?.children[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter' && results[activeIndex]) {
      onSelect(results[activeIndex]);
    } else if (event.key === 'Escape') {
      onCancel?.();
    }
  };

  return (
    <div className="flex flex-col w-full rounded-xl border border-vscode-border bg-vscode-sidebar shadow-xl overflow-hidden">
      <div className="relative border-b border-vscode-border shrink-0">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search files by name or path"
          aria-label="Search files"
          role="combobox"
          aria-expanded="true"
          aria-controls="cf-file-results"
          className="w-full bg-transparent text-vscode-fg pl-9 pr-3 py-2.5 text-sm focus:outline-none"
        />
      </div>

      <div
        id="cf-file-results"
        ref={listRef}
        role="listbox"
        aria-label="Files"
        className="max-h-80 overflow-y-auto p-1"
      >
        {results.map((filePath, index) => {
          const slash = filePath.lastIndexOf('/');
          return (
            <div
              key={filePath}
              role="option"
              aria-selected={index === activeIndex}
              onClick={() => onSelect(filePath)}
              onMouseMove={() => setActiveIndex(index)}
              className={`flex items-center gap-2 px-2 py-1 rounded-md text-xs cursor-pointer ${
                index === activeIndex ? 'bg-vscode-active text-vscode-activeFg' : 'text-gray-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5 shrink-0 opacity-60" />
              <span className="font-medium truncate shrink">{filePath.slice(slash + 1)}</span>
              {slash > 0 && (
                <span className="text-[11px] opacity-60 truncate shrink-[2]">
                  {filePath.slice(0, slash)}
                </span>
              )}
            </div>
          );
        })}
        {results.length === 0 && (
          <div className="px-3 py-6 text-center text-xs text-gray-400">
            {files === null ? 'Loading files…' : 'No matching files'}
          </div>
        )}
      </div>
    </div>
  );
};
