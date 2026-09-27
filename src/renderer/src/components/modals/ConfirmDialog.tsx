import React from 'react'
import { ShieldAlert } from 'lucide-react'

export interface ConfirmDialogAction {
  label: string
  onClick: () => void
  variant?: 'default' | 'danger'
}

export interface ConfirmDialogState {
  title: string
  message: string
  cancelLabel?: string
  // Single-action dialogs (the common case) keep using confirmLabel/onConfirm.
  confirmLabel?: string
  onConfirm?: () => void
  // Multi-action dialogs (e.g. "move to trash" vs "delete permanently")
  // render one button per action instead of a single confirm button.
  actions?: ConfirmDialogAction[]
}

interface ConfirmDialogProps {
  state: ConfirmDialogState | null
  onCancel: () => void
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ state, onCancel }) => {
  if (!state) return null

  const actions: ConfirmDialogAction[] = state.actions ?? [
    {
      label: state.confirmLabel || 'CONFIRMAR',
      onClick: state.onConfirm || (() => {}),
      variant: 'default'
    }
  ]

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-dialog-top-bar" />

        <div className="confirm-dialog-icon-row">
          <ShieldAlert className="confirm-dialog-icon" size={20} />
          <span className="confirm-dialog-title">{state.title}</span>
        </div>

        <p className="confirm-dialog-message">{state.message}</p>

        <div className="confirm-dialog-actions">
          <button className="confirm-dialog-btn confirm-dialog-btn-cancel" onClick={onCancel}>
            {state.cancelLabel || 'CANCELAR'}
          </button>
          {actions.map((action) => (
            <button
              key={action.label}
              className={`confirm-dialog-btn ${
                action.variant === 'danger'
                  ? 'confirm-dialog-btn-danger'
                  : 'confirm-dialog-btn-confirm'
              }`}
              onClick={action.onClick}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default ConfirmDialog
