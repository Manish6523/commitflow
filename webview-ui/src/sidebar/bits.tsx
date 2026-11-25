import React, { useEffect, useRef } from 'react';
import { fileIcon } from './fileIcons';
import { iconFontName, useScmStore } from './scmStore';

/** A VS Code codicon. `name` may carry extra classes, like "sync scm-spin". */
export const Icon: React.FC<{ name: string; style?: React.CSSProperties }> = ({ name, style }) => {
  const [icon, ...extra] = name.split(' ');
  return <span className={`codicon codicon-${icon} ${extra.join(' ')}`} style={style} aria-hidden="true" />;
};

/** A file's icon from the editor's icon theme, or a built-in one if the theme has none. */
export const FileTypeIcon: React.FC<{ path: string }> = ({ path }) => {
  const icon = useScmStore((s) => s.icons[path]);
  if (icon?.image) return <img className="scm-file-icon" src={icon.image} alt="" draggable={false} />;
  if (icon?.character) {
    return (
      <span
        className="scm-file-icon"
        style={{ fontFamily: `"${iconFontName(icon.font ?? '')}"`, color: icon.color, fontSize: icon.size }}
        aria-hidden="true"
      >
        {icon.character}
      </span>
    );
  }
  const builtIn = fileIcon(path);
  return <Icon name={builtIn.icon} style={{ color: builtIn.color }} />;
};

export const IconButton: React.FC<{
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}> = ({ icon, label, onClick, disabled }) => (
  <button
    className="scm-icon-button"
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    onDoubleClick={(e) => e.stopPropagation()}
    disabled={disabled}
    title={label}
    aria-label={label}
  >
    <Icon name={icon} />
  </button>
);

export type MenuEntry = 'separator' | { label: string; run: () => void; disabled?: boolean };

/** A small dropdown menu. Closes on Escape, a click outside, or picking an item. */
export const Menu: React.FC<{ items: MenuEntry[]; onClose: () => void; style?: React.CSSProperties }> = ({
  items,
  onClose,
  style,
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    const outside = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    // Wait a tick so the click that opened the menu doesn't close it.
    const timer = setTimeout(() => window.addEventListener('mousedown', outside));
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousedown', outside);
    };
  }, [onClose]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const buttons = [...(ref.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])];
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      buttons[(index + step + buttons.length) % buttons.length]?.focus();
    }
  };

  return (
    <div ref={ref} className="scm-menu" role="menu" style={style} onKeyDown={onKeyDown}>
      {items.map((item, i) =>
        item === 'separator' ? (
          <div key={i} className="scm-menu-separator" role="separator" />
        ) : (
          <button
            key={item.label}
            className="scm-menu-item"
            role="menuitem"
            disabled={item.disabled}
            style={item.disabled ? { opacity: 0.5, cursor: 'default' } : undefined}
            onClick={() => {
              onClose();
              item.run();
            }}
          >
            {item.label}
          </button>
        )
      )}
    </div>
  );
};

/** Chevron, title and count for a collapsible group. Actions appear on hover. */
export const SectionHeader: React.FC<{
  title: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
  pane?: boolean;
  children?: React.ReactNode;
}> = ({ title, count, open, onToggle, pane, children }) => (
  <div
    className={pane ? 'scm-pane-header' : 'scm-header'}
    role="button"
    tabIndex={0}
    aria-expanded={open}
    onClick={onToggle}
    onKeyDown={(e) => {
      if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        onToggle();
      }
    }}
  >
    <Icon name={open ? 'chevron-down' : 'chevron-right'} />
    <span className="scm-header-title scm-truncate">{title}</span>
    {children && <span className="scm-actions">{children}</span>}
    {count !== undefined && <span className="scm-badge">{count}</span>}
  </div>
);
