import { useEffect, useRef, useState } from 'react'
import { Titlebar, Sidebar, TipTapEditor, EditorFooter, OnboardingModal } from './components'
import useVault from './hooks/useVault'
import useNotes from './hooks/useNotes'

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
    saveStatus,
    setSearchQuery,
    selectNote,
    createNote,
    deleteNote,
    renameNote,
    toggleFavorite,
    exportTxt,
    handleContentChange
  } = useNotes(vaultState.activeVaultPath)

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

  const handleDeleteNoteByPath = async (notePath: string) => {
    const confirmDelete = window.confirm('Tem certeza que deseja mover esta nota para a lixeira?')
    if (confirmDelete) {
      await deleteNote(notePath)
    }
  }

  const handleDeleteNote = async () => {
    if (activeNotePath) {
      await handleDeleteNoteByPath(activeNotePath)
    }
  }

  const handleRemoveVault = async (vaultPath: string) => {
    const confirmRemove = window.confirm(
      vaultState.vaults.length <= 1
        ? 'Este é o último vault da lista. Removê-lo não apagará os arquivos, mas nenhum vault ficará selecionado. Deseja continuar?'
        : 'Remover este vault da lista? Os arquivos não serão apagados do disco.'
    )
    if (!confirmRemove) return

    const state = await removeVault(vaultPath)
    if (state && !state.activeVaultPath) {
      window.alert('Nenhum vault restante. Adicione um vault para continuar.')
    }
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

  const handleExportTxt = async () => {
    if (activeNotePath) {
      const exportedPath = await exportTxt()
      if (exportedPath) {
        window.alert(`Nota exportada com sucesso para:\n${exportedPath}`)
      }
    }
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
            isCompact={isCompact}
            onSearchChange={setSearchQuery}
            onSelectNote={selectNote}
            onToggleFavorite={toggleFavorite}
            onSelectVault={selectActiveVault}
            onAddVault={selectVaultFolder}
            onRemoveVault={handleRemoveVault}
            onRenameNote={renameNote}
            onDeleteNote={handleDeleteNoteByPath}
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
            onExportTxt={handleExportTxt}
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
    </div>
  )
}

export default App
