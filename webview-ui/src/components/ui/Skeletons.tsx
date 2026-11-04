import React from 'react';

const Bar: React.FC<{ className: string }> = ({ className }) => (
  <div className={`cf-skeleton rounded ${className}`} />
);

export const CommitCardsSkeleton: React.FC = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3" aria-label="Loading commits">
    {Array.from({ length: 9 }, (_, i) => (
      <div key={i} className="px-3 py-2.5 border-b border-r border-vscode-border space-y-2">
        <Bar className="h-3.5 w-3/4" />
        <Bar className="h-3 w-1/2" />
        <Bar className="h-3 w-1/3" />
      </div>
    ))}
  </div>
);

export const CommitRowsSkeleton: React.FC<{ count?: number }> = ({ count = 12 }) => (
  <div className="space-y-3 p-3" aria-label="Loading commits">
    {Array.from({ length: count }, (_, i) => (
      <div key={i} className="space-y-1.5">
        <Bar className="h-3 w-4/5" />
        <Bar className="h-2.5 w-2/5" />
      </div>
    ))}
  </div>
);
