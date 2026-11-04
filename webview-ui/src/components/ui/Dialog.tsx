import React, { useEffect } from 'react';
import { useCommitStore } from '../../stores/useCommitStore';
import { dangerButton, ghostButton, primaryButton } from './styles';

interface DialogProps {
  title: string;
  icon?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}

export const Dialog: React.FC<DialogProps> = ({ title, icon, onClose, children }) => {
  useEffect(() => {
    // Captured first so Esc closes only the dialog, not the page behind it.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[16vh] px-4 bg-black/40 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-sm flex flex-col gap-3 p-4 rounded-xl border border-vscode-border bg-vscode-sidebar shadow-xl animate-in fade-in zoom-in-95 slide-in-from-top-1 duration-150"
      >
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-100">
          {icon}
          {title}
        </h3>
        {children}
      </div>
    </div>
  );
};

interface DialogButtonsProps {
  onCancel: () => void;
  onConfirm: () => void;
  label: string;
  danger?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
}

export const DialogButtons: React.FC<DialogButtonsProps> = ({
  onCancel,
  onConfirm,
  label,
  danger,
  disabled,
  autoFocus,
}) => (
  <div className="flex justify-end gap-2 pt-1">
    <button onClick={onCancel} className={ghostButton}>
      Cancel
    </button>
    <button
      onClick={onConfirm}
      disabled={disabled}
      autoFocus={autoFocus}
      className={danger ? dangerButton : primaryButton}
    >
      {label}
    </button>
  </div>
);

/** Webviews block window.confirm, so confirmations are shown here instead. */
export const ConfirmDialog: React.FC = () => {
  const { pendingConfirm, requestConfirm } = useCommitStore();
  if (!pendingConfirm) return null;

  const close = () => requestConfirm(null);
  return (
    <Dialog title={pendingConfirm.title} onClose={close}>
      {pendingConfirm.detail && <p className="text-xs text-gray-400">{pendingConfirm.detail}</p>}
      <DialogButtons
        onCancel={close}
        onConfirm={() => {
          close();
          pendingConfirm.onConfirm();
        }}
        label={pendingConfirm.label}
        danger={pendingConfirm.danger}
        autoFocus
      />
    </Dialog>
  );
};
