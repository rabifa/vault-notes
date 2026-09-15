import { useCallback, useState } from 'react'
import { ToastItem } from '../components/common/Toast'

let nextToastId = 1

export const useToast = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const showToast = useCallback((message: string, variant: ToastItem['variant'] = 'success') => {
    const id = nextToastId++
    setToasts((prev) => [...prev, { id, message, variant }])
  }, [])

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return { toasts, showToast, dismissToast }
}

export default useToast
