import React from 'react';

const STATUS_STYLES: Record<string, string> = {
  A: 'bg-emerald-500/20 text-emerald-400',
  U: 'bg-emerald-500/20 text-emerald-400',
  '?': 'bg-emerald-500/20 text-emerald-400',
  M: 'bg-amber-500/20 text-amber-400',
  D: 'bg-rose-500/20 text-rose-400',
  R: 'bg-purple-500/20 text-purple-400',
  C: 'bg-purple-500/20 text-purple-400',
};

const STATUS_NAMES: Record<string, string> = {
  A: 'Added',
  U: 'Untracked',
  '?': 'Untracked',
  M: 'Modified',
  D: 'Deleted',
  R: 'Renamed',
  C: 'Copied',
};

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => (
  <span
    title={STATUS_NAMES[status]}
    className={`inline-flex items-center justify-center w-4 h-4 rounded text-[10px] font-bold shrink-0 ${
      STATUS_STYLES[status] ?? 'bg-blue-500/20 text-blue-500'
    }`}
  >
    {status}
  </span>
);
