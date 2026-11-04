import React from 'react';

const STATUS_STYLES: Record<string, string> = {
  A: 'bg-emerald-500/20 text-emerald-500',
  D: 'bg-rose-500/20 text-rose-500',
  R: 'bg-purple-500/20 text-purple-500',
  C: 'bg-purple-500/20 text-purple-500',
};

const STATUS_NAMES: Record<string, string> = {
  A: 'Added',
  D: 'Deleted',
  M: 'Modified',
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
