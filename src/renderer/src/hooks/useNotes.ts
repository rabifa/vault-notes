import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { NoteMetadata } from '../types/vault'
import { SaveStatus } from '../components/editor/EditorFooter'
import { toPreviewText } from '../utils/markdown'

export const useNotes = (activeVaultPath: string | null) => {
  const [notes, setNotes] = useState<NoteMetadata[]>([])
  const [activeNotePath, setActiveNotePath] = useState<string | null>(null)
  const [activeNoteContent, setActiveNoteContent] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [isLoadingNotes, setIsLoadingNotes] = useState<boolean>(false)
  const [isLoadingContent, setIsLoadingContent] = useState<boolean>(false)

  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const activeNotePathRef = useRef<string | null>(null)
  const activeNoteContentRef = useRef<string>('')
  const isCreatingInitialNoteRef = useRef(false)

  // Sync refs to avoid stale closures in debounced functions
  useEffect(() => {
    activeNotePathRef.current = activeNotePath
  }, [activeNotePath])

  useEffect(() => {
    activeNoteContentRef.current = activeNoteContent
  }, [activeNoteContent])

  // Fetch note list from active vault
  const fetchNotes = useCallback(async () => {
    if (!activeVaultPath) {
      setNotes([])
      return
    }
    setIsLoadingNotes(true)
    try {
      let list = await window.api.vault.listNotes(activeVaultPath)

      // Auto-create a first note so the user is never stuck on an empty
      // vault with no way to open the editor and start writing.
      if (list.length === 0 && !isCreatingInitialNoteRef.current) {
        isCreatingInitialNoteRef.current = true
        try {
          const newNote = await window.api.vault.createNote(activeVaultPath, 'Sem Titulo', 'md')
          list = await window.api.vault.listNotes(activeVaultPath)
          setActiveNotePath(newNote.path)
        } finally {
          isCreatingInitialNoteRef.current = false
        }
      }

      setNotes(list)
    } catch (error) {
      console.error('Failed to list notes:', error)
    } finally {
      setIsLoadingNotes(false)
    }
  }, [activeVaultPath])

  // Initial fetch and FS change watcher subscription
  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  useEffect(() => {
    if (!activeVaultPath) return

    // Register folder changes watcher on the main process
    window.api.vault.watchChanges(activeVaultPath)

    const unsubscribe = window.api.vault.onFileChanged((event, filePath) => {
      fetchNotes()
      // If the active note is unlinked (deleted) externally, reset active state
      if (event === 'unlink' && filePath === activeNotePathRef.current) {
        setActiveNotePath(null)
        setActiveNoteContent('')
        setSaveStatus('idle')
      }
    })

    return () => {
      unsubscribe()
    }
  }, [activeVaultPath, fetchNotes])

  // Load note body on active path change
  useEffect(() => {
    const loadNoteContent = async () => {
      if (!activeNotePath) {
        setActiveNoteContent('')
        setSaveStatus('idle')
        return
      }
      setIsLoadingContent(true)
      try {
        const content = await window.api.vault.readNote(activeNotePath)
        setActiveNoteContent(content)
        setSaveStatus('saved')
      } catch (error) {
        console.error('Failed to read note content:', error)
        setActiveNoteContent('')
        setSaveStatus('idle')
      } finally {
        setIsLoadingContent(false)
      }
    }

    loadNoteContent()
  }, [activeNotePath])

  // Save utility to run write action
  const saveNoteImmediately = async (path: string, content: string) => {
    setSaveStatus('saving')
    try {
      await window.api.vault.saveNote(path, content)
      setSaveStatus('saved')

      // Update note list metadata locally
      setNotes((prevNotes) =>
        prevNotes.map((note) =>
          note.path === path
            ? {
                ...note,
                updatedAt: Date.now(),
                preview: toPreviewText(content)
              }
            : note
        )
      )
    } catch (error) {
      console.error('Failed to save note:', error)
      setSaveStatus('dirty')
    }
  }

  // Content edit handler with 500ms debounced autosave
  const handleContentChange = useCallback((newContent: string) => {
    const path = activeNotePathRef.current
    if (!path) return

    setSaveStatus('dirty')
    setActiveNoteContent(newContent)

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      saveNoteImmediately(path, newContent)
    }, 500)
  }, [])

  // Switch to another note, flushing any pending changes first
  const selectNote = useCallback(
    async (newPath: string) => {
      const currentPath = activeNotePathRef.current
      const currentContent = activeNoteContentRef.current

      if (currentPath && saveStatus === 'dirty') {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }
        await saveNoteImmediately(currentPath, currentContent)
      }

      setActiveNotePath(newPath)
    },
    [saveStatus]
  )

  // Create a new note
  const createNote = useCallback(
    async (title = 'Sem Titulo', extension = 'md') => {
      if (!activeVaultPath) return null
      try {
        const newNote = await window.api.vault.createNote(activeVaultPath, title, extension)
        await fetchNotes()
        await selectNote(newNote.path)
        return newNote
      } catch (error) {
        console.error('Failed to create note:', error)
        return null
      }
    },
    [activeVaultPath, fetchNotes, selectNote]
  )

  // Delete note
  const deleteNote = useCallback(
    async (notePath: string) => {
      try {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }
        await window.api.vault.deleteNote(notePath)

        if (activeNotePath === notePath) {
          setActiveNotePath(null)
          setActiveNoteContent('')
          setSaveStatus('idle')
        }
        await fetchNotes()
      } catch (error) {
        console.error('Failed to delete note:', error)
      }
    },
    [activeNotePath, fetchNotes]
  )

  // Rename a note (and update local states)
  const renameNote = useCallback(async (notePath: string, newTitle: string) => {
    try {
      const result = await window.api.vault.renameNote(notePath, newTitle)

      if (activeNotePathRef.current === notePath) {
        activeNotePathRef.current = result.path
        setActiveNotePath(result.path)
      }

      setNotes((prevNotes) =>
        prevNotes.map((note) =>
          note.path === notePath
            ? {
                ...note,
                path: result.path,
                title: result.title,
                updatedAt: result.updatedAt
              }
            : note
        )
      )
    } catch (error) {
      console.error('Failed to rename note:', error)
    }
  }, [])

  // Toggle favorite
  const toggleFavorite = useCallback(async (notePath: string) => {
    try {
      const isFav = await window.api.vault.toggleFavorite(notePath)
      setNotes((prevNotes) =>
        prevNotes.map((note) => (note.path === notePath ? { ...note, isFavorite: isFav } : note))
      )
    } catch (error) {
      console.error('Failed to toggle favorite:', error)
    }
  }, [])

  // Download a copy of a note's raw content under a chosen extension
  const downloadNote = useCallback(
    async (notePath: string, extension: 'md' | 'txt') => {
      try {
        const currentPath = activeNotePathRef.current
        const currentContent = activeNoteContentRef.current

        if (saveStatus === 'dirty' && currentPath === notePath) {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
          }
          await saveNoteImmediately(currentPath, currentContent)
        }

        const contentToExport =
          currentPath === notePath ? currentContent : await window.api.vault.readNote(notePath)

        return await window.api.vault.exportNote(notePath, contentToExport, extension)
      } catch (error) {
        console.error('Failed to download note:', error)
        return null
      }
    },
    [saveStatus]
  )

  // Change a note's file extension in place (no content conversion)
  const changeExtension = useCallback(
    async (notePath: string, newExtension: 'md' | 'txt') => {
      try {
        const currentPath = activeNotePathRef.current

        if (saveStatus === 'dirty' && currentPath === notePath) {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
          }
          await saveNoteImmediately(currentPath, activeNoteContentRef.current)
        }

        const result = await window.api.vault.changeExtension(notePath, newExtension)

        if (currentPath === notePath) {
          activeNotePathRef.current = result.path
          setActiveNotePath(result.path)
        }

        setNotes((prevNotes) =>
          prevNotes.map((note) =>
            note.path === notePath
              ? {
                  ...note,
                  path: result.path,
                  extension: result.extension,
                  updatedAt: result.updatedAt
                }
              : note
          )
        )
      } catch (error) {
        console.error('Failed to change note extension:', error)
      }
    },
    [saveStatus]
  )

  // Flush any pending saves on component unmount
  useEffect(() => {
    return () => {
      const currentPath = activeNotePathRef.current
      const currentContent = activeNoteContentRef.current
      if (currentPath && saveStatus === 'dirty') {
        window.api.vault.saveNote(currentPath, currentContent).catch((err) => {
          console.error('Failed to save pending changes on unmount:', err)
        })
      }
    }
  }, [saveStatus])

  // Fast, reactive notes filtering + favorites-first ordering (stable within each group)
  const filteredNotes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const matched = query
      ? notes.filter(
          (note) =>
            note.title.toLowerCase().includes(query) || note.preview.toLowerCase().includes(query)
        )
      : notes

    return [...matched].sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite))
  }, [notes, searchQuery])

  // Get active note metadata
  const activeNote = useMemo(() => {
    return notes.find((note) => note.path === activeNotePath) || null
  }, [notes, activeNotePath])

  return {
    notes: filteredNotes,
    allNotes: notes,
    activeNotePath,
    activeNote,
    activeNoteContent,
    searchQuery,
    saveStatus,
    isLoadingNotes,
    isLoadingContent,
    setSearchQuery,
    selectNote,
    createNote,
    deleteNote,
    renameNote,
    toggleFavorite,
    downloadNote,
    changeExtension,
    handleContentChange
  }
}

export default useNotes
