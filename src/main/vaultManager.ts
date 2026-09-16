import { dialog, shell, BrowserWindow } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { FSWatcher, watch } from 'chokidar'
import Store from 'electron-store'

// Initialize the electron-store
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const store: any = new Store({
  defaults: {
    vaults: [] as string[],
    activeVaultPath: null as string | null,
    favorites: [] as string[]
  }
})

let watcher: FSWatcher | null = null

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

/**
 * Strips common Markdown syntax (headings, lists, checkboxes, emphasis,
 * links, code, blockquotes, rules) down to plain text. Run before
 * collapsing whitespace, since it relies on line boundaries.
 */
function stripMarkdownSyntax(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s*[-*+]\s+\[[ xX]\]\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/^\s{0,3}([-*_])\s*(?:\1\s*){2,}$/gm, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
}

/**
 * Gets a clean preview of the file content (up to 150 characters, removing HTML/markdown formatting)
 */
async function getNotePreview(filePath: string): Promise<string> {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8')
    // Strip Markdown syntax and embedded HTML tags, then collapse whitespace
    const cleanText = stripMarkdownSyntax(content)
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    return cleanText.slice(0, 150)
  } catch (error) {
    return ''
  }
}

/**
 * Opens a folder selection dialog for the user to pick/create a vault folder.
 */
export async function selectVaultFolder(window?: BrowserWindow): Promise<VaultState | null> {
  const options: Electron.OpenDialogOptions = {
    title: 'Selecionar Pasta do Vault',
    properties: ['openDirectory', 'createDirectory']
  }

  const result = window
    ? await dialog.showOpenDialog(window, options)
    : await dialog.showOpenDialog(options)

  if (result.canceled || result.filePaths.length === 0) {
    return null
  }

  const selectedPath = result.filePaths[0]
  const vaults = store.get('vaults') as string[]

  if (!vaults.includes(selectedPath)) {
    vaults.push(selectedPath)
    store.set('vaults', vaults)
  }

  store.set('activeVaultPath', selectedPath)

  return getActiveVault()
}

/**
 * Returns the current active vault, list of all saved vaults, and favorites.
 */
export function getActiveVault(): VaultState {
  return {
    activeVaultPath: store.get('activeVaultPath') as string | null,
    vaults: store.get('vaults') as string[],
    favorites: store.get('favorites') as string[]
  }
}

/**
 * Sets the active vault to the specified path.
 */
export function setActiveVault(vaultPath: string): VaultState {
  const vaults = store.get('vaults') as string[]
  if (!vaults.includes(vaultPath)) {
    vaults.push(vaultPath)
    store.set('vaults', vaults)
  }
  store.set('activeVaultPath', vaultPath)
  return getActiveVault()
}

/**
 * Lists all .md and .txt notes in the specified vault folder with their metadata.
 */
export async function listVaultNotes(vaultPath: string): Promise<NoteMetadata[]> {
  if (!vaultPath || !fs.existsSync(vaultPath)) {
    return []
  }

  try {
    const files = await fs.promises.readdir(vaultPath, { withFileTypes: true })
    const favorites = store.get('favorites') as string[]

    const notePromises = files
      .filter((file) => {
        if (!file.isFile()) return false
        const ext = path.extname(file.name).toLowerCase()
        return ext === '.md' || ext === '.txt'
      })
      .map(async (file) => {
        const ext = path.extname(file.name).toLowerCase()
        const fullPath = path.join(vaultPath, file.name)
        const stats = await fs.promises.stat(fullPath)
        const title = path.basename(file.name, ext)
        const preview = await getNotePreview(fullPath)
        const isFavorite = favorites.includes(fullPath)

        return {
          path: fullPath,
          title,
          extension: ext,
          updatedAt: stats.mtimeMs,
          createdAt: stats.birthtimeMs,
          preview,
          isFavorite
        }
      })

    const notes = await Promise.all(notePromises)
    // Sort by creation date descending (most recently created first)
    return notes.sort((a, b) => b.createdAt - a.createdAt)
  } catch (error) {
    console.error('Error listing notes in vault:', error)
    return []
  }
}

/**
 * Reads the UTF-8 content of a note.
 */
export async function readNote(notePath: string): Promise<string> {
  if (!fs.existsSync(notePath)) {
    throw new Error(`File not found: ${notePath}`)
  }
  return fs.promises.readFile(notePath, 'utf-8')
}

/**
 * Saves content to a note.
 */
export async function saveNote(notePath: string, content: string): Promise<{ updatedAt: number }> {
  await fs.promises.writeFile(notePath, content, 'utf-8')
  const stats = await fs.promises.stat(notePath)
  return { updatedAt: stats.mtimeMs }
}

/**
 * Creates a new note in the specified vault path.
 * Guarantees no files are overwritten by appending a numerical counter if needed.
 */
export async function createNote(
  vaultPath: string,
  title: string,
  extension: string
): Promise<NoteMetadata> {
  if (!fs.existsSync(vaultPath)) {
    throw new Error(`Vault folder does not exist: ${vaultPath}`)
  }

  const baseName = title.trim() || 'Untitled'
  const ext = extension.startsWith('.') ? extension.toLowerCase() : `.${extension.toLowerCase()}`

  let fileName = `${baseName}${ext}`
  let fullPath = path.join(vaultPath, fileName)
  let counter = 1

  while (fs.existsSync(fullPath)) {
    fileName = `${baseName} ${counter}${ext}`
    fullPath = path.join(vaultPath, fileName)
    counter++
  }

  await fs.promises.writeFile(fullPath, '', 'utf-8')
  const stats = await fs.promises.stat(fullPath)
  const actualTitle = path.basename(fileName, ext)

  return {
    path: fullPath,
    title: actualTitle,
    extension: ext,
    updatedAt: stats.mtimeMs,
    createdAt: stats.birthtimeMs,
    preview: '',
    isFavorite: false
  }
}

/**
 * Deletes a note by moving it to the system trash or deleting if trash fails.
 */
export async function deleteNote(notePath: string): Promise<void> {
  if (fs.existsSync(notePath)) {
    try {
      await shell.trashItem(notePath)
    } catch (error) {
      console.warn('Failed to move to trash, deleting permanently:', error)
      await fs.promises.unlink(notePath)
    }

    // Clean up favorites
    const favorites = store.get('favorites') as string[]
    if (favorites.includes(notePath)) {
      store.set(
        'favorites',
        favorites.filter((p) => p !== notePath)
      )
    }
  }
}

/**
 * Renames a note in the filesystem.
 */
export async function renameNote(
  notePath: string,
  newTitle: string
): Promise<{ path: string; title: string; updatedAt: number }> {
  if (!fs.existsSync(notePath)) {
    throw new Error(`Note not found: ${notePath}`)
  }

  const ext = path.extname(notePath)
  const dir = path.dirname(notePath)
  const cleanTitle = newTitle.replace(/[\\/:*?"<>|]/g, '').trim() || 'Untitled'
  let newFileName = `${cleanTitle}${ext}`
  let newPath = path.join(dir, newFileName)

  if (newPath === notePath) {
    const stats = await fs.promises.stat(notePath)
    return { path: notePath, title: cleanTitle, updatedAt: stats.mtimeMs }
  }

  let counter = 1
  while (fs.existsSync(newPath)) {
    newFileName = `${cleanTitle} ${counter}${ext}`
    newPath = path.join(dir, newFileName)
    counter++
  }

  await fs.promises.rename(notePath, newPath)
  const stats = await fs.promises.stat(newPath)

  // Update favorites if it was favorited
  const favorites = store.get('favorites') as string[]
  if (favorites.includes(notePath)) {
    const updatedFavorites = favorites.map((p) => (p === notePath ? newPath : p))
    store.set('favorites', updatedFavorites)
  }

  return {
    path: newPath,
    title: path.basename(newFileName, ext),
    updatedAt: stats.mtimeMs
  }
}

/**
 * Exports note content to a custom .txt path selected by the user.
 */
export async function exportTxt(
  notePath: string,
  content: string,
  window?: BrowserWindow
): Promise<string | null> {
  const defaultName = `${path.basename(notePath, path.extname(notePath))}.txt`
  const defaultPath = path.join(path.dirname(notePath), defaultName)

  const options: Electron.SaveDialogOptions = {
    title: 'Exportar Nota para Texto',
    defaultPath,
    filters: [{ name: 'Arquivos de Texto (*.txt)', extensions: ['txt'] }]
  }

  const result = window
    ? await dialog.showSaveDialog(window, options)
    : await dialog.showSaveDialog(options)

  if (result.canceled || !result.filePath) {
    return null
  }

  await fs.promises.writeFile(result.filePath, content, 'utf-8')
  return result.filePath
}

/**
 * Toggles a note's favorite status.
 */
export function toggleFavorite(notePath: string): boolean {
  const favorites = store.get('favorites') as string[]
  const index = favorites.indexOf(notePath)
  let isFavorite = false

  if (index !== -1) {
    favorites.splice(index, 1)
  } else {
    favorites.push(notePath)
    isFavorite = true
  }

  store.set('favorites', favorites)
  return isFavorite
}

/**
 * Starts watching a folder for external modifications.
 */
export function watchVault(vaultPath: string, webContents: Electron.WebContents): void {
  if (watcher) {
    watcher.close()
  }

  watcher = watch(vaultPath, {
    depth: 0,
    ignoreInitial: true
  })

  watcher.on('all', (event, filePath) => {
    const ext = path.extname(filePath).toLowerCase()
    if (ext === '.md' || ext === '.txt') {
      webContents.send('vault:file-changed', { event, path: filePath })
    }
  })
}

/**
 * Stops watching the active vault.
 */
export function unwatchVault(): void {
  if (watcher) {
    watcher.close()
    watcher = null
  }
}
