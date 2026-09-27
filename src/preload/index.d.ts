import { ElectronAPI } from '@electron-toolkit/preload'
import { VaultAPI } from '../renderer/src/types/vault'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      getPathForFile: (file: File) => string
      vault: VaultAPI
    }
    electronAPI: {
      minimize: () => void
      maximize: () => void
      close: () => void
      isMaximized: () => Promise<boolean>
      onStateChanged: (callback: (isMaximized: boolean) => void) => () => void
    }
  }
}
