import React from 'react';

interface TimelineRowProps {
  active?: boolean;
  isLast: boolean;
  dotClass: string;
  title: React.ReactNode;
  meta: React.ReactNode;
  actions?: React.ReactNode;
  onClick: () => void;
  rowProps?: React.HTMLAttributes<HTMLDivElement> & { 'data-key'?: string };
}

export const TimelineRow: React.FC<TimelineRowProps> = ({
  active,
  isLast,
  dotClass,
  title,
  meta,
  actions,
  onClick,
  rowProps,
}) => (
  <div
    {...rowProps}
    onClick={onClick}
    className={`group relative flex gap-2.5 pl-3 pr-2 py-1.5 cursor-pointer transition-colors duration-100 ${
      active ? 'bg-vscode-active text-vscode-activeFg' : 'hover:bg-vscode-hover'
    }`}
  >
    <div className="relative w-2.5 shrink-0">
      {!isLast && <div className="absolute left-[4.5px] top-3 -bottom-3.5 w-px bg-vscode-border" />}
      <div className={`absolute top-1 left-0 w-2.5 h-2.5 rounded-full ${dotClass}`} />
    </div>

    <div className="flex-1 min-w-0">
      <div className="text-xs font-medium truncate">{title}</div>
      <div className="text-[11px] opacity-70 truncate mt-0.5">{meta}</div>
    </div>

    <div className="flex items-center gap-1 shrink-0">{actions}</div>
  </div>
);
