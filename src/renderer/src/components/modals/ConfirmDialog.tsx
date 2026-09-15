import React from 'react'
import { ShieldAlert } from 'lucide-react'

export interface ConfirmDialogState {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
}

interface ConfirmDialogProps {
  state: ConfirmDialogState | null
  onCancel: () => void
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ state, onCancel }) => {
  if (!state) return null

  const handleConfirm = () => {
    state.onConfirm()
  }

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
          <button className="confirm-dialog-btn confirm-dialog-btn-confirm" onClick={handleConfirm}>
            {state.confirmLabel || 'CONFIRMAR'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmDialog
