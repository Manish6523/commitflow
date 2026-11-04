import React from 'react';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  detail?: string;
  children?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, detail, children }) => (
  <div className="flex flex-col items-center justify-center h-full min-h-48 gap-2 p-8 text-center">
    <div className="text-gray-500 mb-1">{icon}</div>
    <span className="text-sm font-semibold text-gray-200">{title}</span>
    {detail && <span className="text-xs text-gray-400 max-w-sm">{detail}</span>}
    {children}
  </div>
);
