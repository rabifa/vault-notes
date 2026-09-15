import React, { useEffect } from 'react'
import { CheckCircle2, AlertTriangle, X } from 'lucide-react'

export interface ToastItem {
  id: number
  message: string
  variant: 'success' | 'warning'
}

interface ToastContainerProps {
  toasts: ToastItem[]
  onDismiss: (id: number) => void
}

const TOAST_DURATION_MS = 5000

const ToastEntry: React.FC<{ toast: ToastItem; onDismiss: (id: number) => void }> = ({
  toast,
  onDismiss
}) => {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), TOAST_DURATION_MS)
    return () => clearTimeout(timer)
  }, [toast.id, onDismiss])

  const Icon = toast.variant === 'success' ? CheckCircle2 : AlertTriangle

  return (
    <div className={`toast toast-${toast.variant}`}>
      <Icon className="toast-icon" size={16} />
      <span className="toast-message">{toast.message}</span>
      <button className="toast-close-btn" onClick={() => onDismiss(toast.id)}>
        <X size={14} />
      </button>
    </div>
  )
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <ToastEntry key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

export default ToastContainer
