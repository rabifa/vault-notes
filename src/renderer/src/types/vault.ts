export interface NoteMetadata {
  path: string
  title: string
  extension: string
  updatedAt: number
  createdAt: number
  preview: string
  isFavorite: boolean
}

export interface VaultState {
  activeVaultPath: string | null
  vaults: string[]
  favorites: string[]
}

export interface VaultAPI {
  selectFolder: () => Promise<VaultState | null>
  getActiveVault: () => Promise<VaultState>
  setActiveVault: (vaultPath: string) => Promise<VaultState>
  removeVault: (vaultPath: string) => Promise<VaultState>
  listNotes: (vaultPath: string) => Promise<NoteMetadata[]>
  readNote: (notePath: string) => Promise<string>
  saveNote: (notePath: string, content: string) => Promise<{ updatedAt: number }>
  createNote: (vaultPath: string, title: string, extension: string) => Promise<NoteMetadata>
  deleteNote: (notePath: string) => Promise<void>
  renameNote: (
    notePath: string,
    newTitle: string
  ) => Promise<{ path: string; title: string; updatedAt: number }>
  exportTxt: (notePath: string, content: string) => Promise<string | null>
  toggleFavorite: (notePath: string) => Promise<boolean>
  watchChanges: (vaultPath: string) => Promise<void>
  openFolder: (vaultPath: string) => Promise<string>
  onFileChanged: (callback: (event: string, path: string) => void) => () => void
}
