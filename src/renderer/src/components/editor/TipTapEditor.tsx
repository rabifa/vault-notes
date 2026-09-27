import React, { useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TextStyle, FontSize } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import FontFamily from '@tiptap/extension-font-family'
import TextAlign from '@tiptap/extension-text-align'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'

import EditorToolbar from './EditorToolbar'
import brandIcon from '../../assets/images/vault-notes@16x.png'
import { markdownToHtml, htmlToMarkdown, textToHtml } from '../../utils/markdown'

interface TipTapEditorProps {
  notePath: string | null
  noteContent: string
  noteExtension: string
  isSidebarOpen?: boolean
  onToggleSidebar?: () => void
  onDeleteNote?: () => void
  onDuplicateNote?: () => void
  onCreateNote?: () => void
  onContentChange: (newContent: string) => void
  onStatsChange?: (wordCount: number, charCount: number) => void
}

export const TipTapEditor: React.FC<TipTapEditorProps> = ({
  notePath,
  noteContent,
  noteExtension,
  isSidebarOpen = true,
  onToggleSidebar,
  onDeleteNote,
  onDuplicateNote,
  onCreateNote,
  onContentChange,
  onStatsChange
}) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // TaskList handles list items separately
        bulletList: {},
        orderedList: {},
        listItem: {},
        // Not used by this app, and listKeymap's own Backspace handling
        // for "taskItem"/"taskList" duplicates TaskItem's own keymap below.
        link: false,
        listKeymap: false,
        // Auto-inserts an empty paragraph after the document's last node
        // whenever it isn't a paragraph. Left enabled so a code block (or
        // heading, etc.) at the end of a note always has an escape
        // paragraph after it - otherwise reopening the note leaves no
        // paragraph past the code block, so the cursor can only land back
        // inside it and everything typed "below" is stuck as code. Task
        // lists are excluded via notAfter: with them included, this fires
        // on every keystroke while a task list is the last thing in the
        // note, fighting TaskItem's own Enter handling and corrupting new
        // checklist lines.
        trailingNode: {
          notAfter: ['taskList']
        }
      }),
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      TextAlign.configure({
        types: ['heading', 'paragraph']
      }),
      TaskList,
      TaskItem.configure({
        nested: true
      })
    ],
    content: noteExtension === '.txt' ? textToHtml(noteContent) : markdownToHtml(noteContent),
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      const text = editor.getText()

      // Calculate character and word count
      const charCount = text.length
      const wordCount = text.trim() === '' ? 0 : text.trim().split(/\s+/).length

      if (onStatsChange) {
        onStatsChange(wordCount, charCount)
      }

      // Convert back to save format
      const convertedContent = noteExtension === '.txt' ? text : htmlToMarkdown(html)
      lastEmittedContentRef.current = convertedContent

      onContentChange(convertedContent)
    }
  })

  const prevNotePathRef = React.useRef<string | null>(null)
  // Tracks the last content this editor itself produced via typing, so the
  // sync effect can tell "the user's own edit echoing back through props"
  // (safe to skip while focused) apart from a note switch or external file
  // change arriving mid-focus (must always be applied).
  const lastEmittedContentRef = React.useRef<string | null>(null)

  // Synchronize when switching notes or when external updates happen
  useEffect(() => {
    if (!editor || notePath === null) return

    const htmlContent =
      noteExtension === '.txt' ? textToHtml(noteContent) : markdownToHtml(noteContent)

    const isOwnEcho = noteContent === lastEmittedContentRef.current

    // Check if the content is actually different to avoid cursor jumps while typing
    if (editor.getHTML() !== htmlContent && (!isOwnEcho || !editor.isFocused)) {
      editor.commands.setContent(htmlContent, { emitUpdate: false })
      lastEmittedContentRef.current = noteContent

      // Calculate and trigger stats updates immediately on load
      const text = editor.getText()
      const charCount = text.length
      const wordCount = text.trim() === '' ? 0 : text.trim().split(/\s+/).length
      if (onStatsChange) {
        onStatsChange(wordCount, charCount)
      }
    }
  }, [notePath, noteContent, editor, noteExtension])

  // Focus the editor when switching to a different note
  useEffect(() => {
    if (notePath !== prevNotePathRef.current) {
      prevNotePathRef.current = notePath
      if (editor && notePath) {
        editor.commands.focus()
      }
    }
  }, [notePath, editor])

  if (!notePath) {
    return (
      <div className="editor-empty-state">
        <img src={brandIcon} alt="Vault Notes" className="empty-state-icon" draggable="false" />
        <p className="empty-state-title">
          <span className="logo-vault">VAULT</span>
          <span className="logo-notes">NOTES</span>
        </p>
      </div>
    )
  }

  return (
    <div className="editor-panel">
      <EditorToolbar
        editor={editor}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={onToggleSidebar}
        onDeleteNote={onDeleteNote}
        onDuplicateNote={onDuplicateNote}
        onCreateNote={onCreateNote}
      />
      <div className="editor-workspace scrollbar-custom">
        <div className="editor-body">
          <EditorContent editor={editor} className="editor-content" />
        </div>
      </div>
    </div>
  )
}

export default TipTapEditor
