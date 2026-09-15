import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import {
  selectVaultFolder,
  getActiveVault,
  setActiveVault,
  removeVault,
  listVaultNotes,
  readNote,
  saveNote,
  createNote,
  deleteNote,
  renameNote,
  exportNote,
  changeNoteExtension,
  toggleFavorite,
  watchVault,
  unwatchVault
} from './vaultManager'

let mainWindow: BrowserWindow | null = null

function registerIpcHandlers(): void {
  ipcMain.handle('vault:select-folder', async () => {
    return selectVaultFolder(mainWindow || undefined)
  })

  ipcMain.handle('vault:get-active-vault', async () => {
    return getActiveVault()
  })

  ipcMain.handle('vault:set-active-vault', async (_, vaultPath: string) => {
    return setActiveVault(vaultPath)
  })

  ipcMain.handle('vault:remove', async (_, vaultPath: string) => {
    return removeVault(vaultPath)
  })

  ipcMain.handle('vault:list-notes', async (_, vaultPath: string) => {
    return listVaultNotes(vaultPath)
  })

  ipcMain.handle('vault:read-note', async (_, notePath: string) => {
    return readNote(notePath)
  })

  ipcMain.handle('vault:save-note', async (_, notePath: string, content: string) => {
    return saveNote(notePath, content)
  })

  ipcMain.handle(
    'vault:create-note',
    async (_, vaultPath: string, title: string, extension: string) => {
      return createNote(vaultPath, title, extension)
    }
  )

  ipcMain.handle('vault:delete-note', async (_, notePath: string) => {
    return deleteNote(notePath)
  })

  ipcMain.handle('vault:rename-note', async (_, notePath: string, newTitle: string) => {
    return renameNote(notePath, newTitle)
  })

  ipcMain.handle(
    'vault:export-note',
    async (_, notePath: string, content: string, extension: string) => {
      return exportNote(notePath, content, extension, mainWindow || undefined)
    }
  )

  ipcMain.handle('vault:change-extension', async (_, notePath: string, newExtension: string) => {
    return changeNoteExtension(notePath, newExtension)
  })

  ipcMain.handle('vault:toggle-favorite', async (_, notePath: string) => {
    return toggleFavorite(notePath)
  })

  ipcMain.handle('vault:watch-changes', async (event, vaultPath: string) => {
    return watchVault(vaultPath, event.sender)
  })

  ipcMain.handle('vault:open-folder', async (_, vaultPath: string) => {
    return shell.openPath(vaultPath)
  })

  ipcMain.handle('window:is-maximized', () => {
    return mainWindow?.isMaximized() || false
  })
}

function createWindow(): void {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    minWidth: 400,
    minHeight: 420,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    ...(process.platform !== 'darwin' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window:state-changed', true)
  })

  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window:state-changed', false)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Escuta eventos do ipcRenderer para controlar a janela
  ipcMain.on('window:minimize', () => {
    mainWindow?.minimize()
  })

  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow?.maximize()
    }
  })

  ipcMain.on('window:close', () => {
    mainWindow?.close()
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpcHandlers()
  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  unwatchVault()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
