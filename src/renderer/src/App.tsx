import { useEffect, useRef, useState } from 'react'
import {
  Titlebar,
  Sidebar,
  TipTapEditor,
  EditorFooter,
  OnboardingModal,
  ConfirmDialog,
  ToastContainer
} from './components'
import { ConfirmDialogState } from './components/modals/ConfirmDialog'
import useVault from './hooks/useVault'
import useNotes from './hooks/useNotes'
import useToast from './hooks/useToast'

// Below this window width there isn't room for both the sidebar and a
// usable text area, so the sidebar auto-hides. Only reacts to actually
// crossing the line (not every resize tick while already on one side of
// it), so a manual toggle while narrow isn't immediately fought back.
const SIDEBAR_AUTO_HIDE_WIDTH = 600

export const App = () => {
  const { vaultState, selectVaultFolder, selectActiveVault, removeVault } = useVault()

  const {
    notes,
    activeNotePath,
    activeNote,
    activeNoteContent,
    searchQuery,
    sortOption,
    saveStatus,
    setSearchQuery,
    setSortOption,
    selectNote,
    createNote,
    deleteNote,
    renameNote,
    toggleFavorite,
    downloadNote,
    changeExtension,
    handleContentChange
  } = useNotes(vaultState.activeVaultPath)

  const { toasts, showToast, dismissToast } = useToast()
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null)

  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [wordCount, setWordCount] = useState(0)
  const [charCount, setCharCount] = useState(0)
  // Below the same breakpoint, the sidebar (if reopened manually while
  // narrow) takes the full width instead of squeezing a sliver of editor
  // next to it - there isn't room for both to be usable at once.
  const [isCompact, setIsCompact] = useState(window.innerWidth < SIDEBAR_AUTO_HIDE_WIDTH)

  const wasNarrowRef = useRef(window.innerWidth < SIDEBAR_AUTO_HIDE_WIDTH)
  const autoClosedRef = useRef(false)

  useEffect(() => {
    const handleResize = () => {
      const isNarrow = window.innerWidth < SIDEBAR_AUTO_HIDE_WIDTH
      setIsCompact(isNarrow)

      if (isNarrow && !wasNarrowRef.current) {
        setIsSidebarOpen((prev) => {
          if (prev) {
            autoClosedRef.current = true
            return false
          }
          return prev
        })
      } else if (!isNarrow && wasNarrowRef.current && autoClosedRef.current) {
        autoClosedRef.current = false
        setIsSidebarOpen(true)
      }

      wasNarrowRef.current = isNarrow
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleCreateNote = async () => {
    // Creates a new markdown note by default. Users can change text formatting or rename it.
    await createNote('Sem Titulo', 'md')
  }

  const handleDeleteNoteByPath = (notePath: string) => {
    setConfirmDialog({
      title: 'EXCLUIR NOTA',
      message: 'Tem certeza que deseja mover esta nota para a lixeira?',
      confirmLabel: 'EXCLUIR',
      onConfirm: async () => {
        setConfirmDialog(null)
        await deleteNote(notePath)
      }
    })
  }

  const handleDeleteNote = () => {
    if (activeNotePath) {
      handleDeleteNoteByPath(activeNotePath)
    }
  }

  const handleRemoveVault = (vaultPath: string) => {
    const isLastVault = vaultState.vaults.length <= 1
    setConfirmDialog({
      title: 'REMOVER VAULT',
      message: isLastVault
        ? 'Este é o último vault da lista. Removê-lo não apagará os arquivos, mas nenhum vault ficará selecionado. Deseja continuar?'
        : 'Remover este vault da lista? Os arquivos não serão apagados do disco.',
      confirmLabel: 'REMOVER',
      onConfirm: async () => {
        setConfirmDialog(null)
        const state = await removeVault(vaultPath)
        if (state && !state.activeVaultPath) {
          showToast('Nenhum vault restante. Adicione um vault para continuar.', 'warning')
        }
      }
    })
  }

  const handleDuplicateNote = async () => {
    if (activeNote && activeNotePath) {
      const copyTitle = `${activeNote.title} Copia`
      const newNote = await createNote(copyTitle, activeNote.extension.replace('.', ''))
      if (newNote) {
        // Save the content of the copied note into the newly created copy
        await window.api.vault.saveNote(newNote.path, activeNoteContent)
        // Select the new duplicated note
        await selectNote(newNote.path)
      }
    }
  }

  const handleDownloadNote = async (notePath: string, extension: 'md' | 'txt') => {
    const downloadedPath = await downloadNote(notePath, extension)
    if (downloadedPath) {
      showToast(`Nota baixada com sucesso para:\n${downloadedPath}`, 'success')
    }
  }

  const handleChangeNoteExtension = async (notePath: string, newExtension: 'md' | 'txt') => {
    await changeExtension(notePath, newExtension)
    showToast(`Extensão alterada para .${newExtension.toUpperCase()}.`, 'success')
  }

  const handleStatsChange = (words: number, chars: number) => {
    setWordCount(words)
    setCharCount(chars)
  }

  const activeVaultPath = vaultState.activeVaultPath

  return (
    <div className="app-container">
      <Titlebar />

      <div className="main-content">
        {isSidebarOpen && (
          <Sidebar
            vaultState={vaultState}
            notes={notes}
            activeNotePath={activeNotePath}
            searchQuery={searchQuery}
            sortOption={sortOption}
            isCompact={isCompact}
            onSearchChange={setSearchQuery}
            onSortChange={setSortOption}
            onSelectNote={selectNote}
            onToggleFavorite={toggleFavorite}
            onSelectVault={selectActiveVault}
            onAddVault={selectVaultFolder}
            onRemoveVault={handleRemoveVault}
            onRenameNote={renameNote}
            onDeleteNote={handleDeleteNoteByPath}
            onChangeExtension={handleChangeNoteExtension}
            onDownloadNote={handleDownloadNote}
            onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          />
        )}

        <div className="editor-panel-wrapper">
          <TipTapEditor
            notePath={activeNotePath}
            noteContent={activeNoteContent}
            noteExtension={activeNote ? activeNote.extension : '.md'}
            isSidebarOpen={isSidebarOpen}
            onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            onDeleteNote={handleDeleteNote}
            onDuplicateNote={handleDuplicateNote}
            onCreateNote={handleCreateNote}
            onContentChange={handleContentChange}
            onStatsChange={handleStatsChange}
          />

          {activeNotePath && (
            <EditorFooter wordCount={wordCount} charCount={charCount} saveStatus={saveStatus} />
          )}
        </div>
      </div>

      <OnboardingModal isOpen={activeVaultPath === null} onSelectFolder={selectVaultFolder} />
      <ConfirmDialog state={confirmDialog} onCancel={() => setConfirmDialog(null)} />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}

export default App
