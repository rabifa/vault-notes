import React, { useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TextStyle, FontSize } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import FontFamily from '@tiptap/extension-font-family'
import TextAlign from '@tiptap/extension-text-align'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Link from '@tiptap/extension-link'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'

import EditorToolbar from './EditorToolbar'
import { CodeBlockWithCopy } from './CodeBlockWithCopy'
import { TableViewWithEditButton } from './TableViewWithEditButton'
import { ResizableImage } from './ResizableImage'
import { VideoEmbed } from './VideoEmbed'
import { TableMarkdownInputRule } from './TableMarkdownInputRule'
import { LinkMarkdownInputRule } from './LinkMarkdownInputRule'
import { ImageMarkdownInputRule } from './ImageMarkdownInputRule'
import { VideoMarkdownInputRule } from './VideoMarkdownInputRule'
import brandIcon from '../../assets/images/vault-notes@16x.png'
import {
  markdownToHtml,
  htmlToMarkdown,
  textToHtml,
  resolveNoteImageUrl
} from '../../utils/markdown'

const MIME_TO_EXTENSION: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'image/svg+xml': 'svg',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/ogg': 'ogv',
  'video/quicktime': 'mov'
}

// Clipboard screenshots come through as "image/png" almost universally, so
// that's the fallback for anything not in the map above rather than an
// extension-less file.
function extensionForMimeType(mimeType: string): string {
  return MIME_TO_EXTENSION[mimeType] ?? 'png'
}

interface TipTapEditorProps {
  notePath: string | null
  noteContent: string
  noteExtension: string
  isSidebarOpen?: boolean
  onToggleSidebar?: () => void
  onDeleteNote?: (permanent: boolean) => void
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
  // Copies a pasted/dropped image file into the vault's attachments folder
  // the same way EditorToolbar's "Inserir Imagem" button does, then inserts
  // it - at a specific document position when dropped, or at the current
  // cursor when pasted. A screenshot pasted straight from the clipboard has
  // no backing file on disk (getPathForFile returns "" for it), so that
  // case is saved from its raw bytes instead of copied from a source path.
  const insertImageFile = async (file: File, atNotePath: string, pos?: number): Promise<void> => {
    const sourceFilePath = window.api.getPathForFile(file)
    const relativePath = sourceFilePath
      ? await window.api.vault.saveImageAttachment(atNotePath, sourceFilePath)
      : await window.api.vault.saveImageAttachmentFromBuffer(
          atNotePath,
          new Uint8Array(await file.arrayBuffer()),
          extensionForMimeType(file.type)
        )

    const src = resolveNoteImageUrl(relativePath, atNotePath)
    const alt = file.name.replace(/\.[^.]+$/, '')
    const chain = editor.chain().focus()
    if (pos !== undefined) {
      chain.insertContentAt(pos, { type: 'image', attrs: { src, alt } }).run()
    } else {
      chain.setImage({ src, alt }).run()
    }
  }

  // Same idea as insertImageFile, but for a local video file (dropped, or
  // pasted straight as raw bytes) - copied into the vault's attachments the
  // same way, then embedded as a VideoEmbed node (provider "file") instead
  // of an image.
  const insertVideoFile = async (file: File, atNotePath: string, pos?: number): Promise<void> => {
    const sourceFilePath = window.api.getPathForFile(file)
    const relativePath = sourceFilePath
      ? await window.api.vault.saveImageAttachment(atNotePath, sourceFilePath)
      : await window.api.vault.saveImageAttachmentFromBuffer(
          atNotePath,
          new Uint8Array(await file.arrayBuffer()),
          extensionForMimeType(file.type)
        )

    const src = resolveNoteImageUrl(relativePath, atNotePath)
    const alt = file.name.replace(/\.[^.]+$/, '')
    const attrs = { src, alt, provider: 'file' }
    const chain = editor.chain().focus()
    if (pos !== undefined) {
      chain.insertContentAt(pos, { type: 'videoEmbed', attrs }).run()
    } else {
      chain.insertContent({ type: 'videoEmbed', attrs }).run()
    }
  }

  // Some screenshot tools and clipboard managers copy an image as its own
  // Markdown reference text ("![alt](C:\path\to\file.png)") instead of
  // actual image data - handlePaste below only spots that case, but the
  // copy-into-attachments-and-insert step is identical to insertImageFile's,
  // just starting from a path string instead of a File.
  const insertImageFromPath = async (
    sourceFilePath: string,
    alt: string,
    atNotePath: string
  ): Promise<void> => {
    try {
      const relativePath = await window.api.vault.saveImageAttachment(atNotePath, sourceFilePath)
      const src = resolveNoteImageUrl(relativePath, atNotePath)
      editor.chain().focus().setImage({ src, alt }).run()
    } catch {
      // The path in the pasted text didn't resolve to a real file - fall
      // back to inserting the original text so nothing is silently lost.
      editor.chain().focus().insertContent(`![${alt}](${sourceFilePath})`).run()
    }
  }

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // TaskList handles list items separately
        bulletList: {},
        orderedList: {},
        listItem: {},
        // Replaced below by an explicitly configured Link extension
        // (openOnClick disabled so clicking a link edits it instead of
        // navigating away). listKeymap's own Backspace handling for
        // "taskItem"/"taskList" duplicates TaskItem's own keymap below.
        link: false,
        listKeymap: false,
        // Replaced below by CodeBlockWithCopy, which adds a copy button.
        codeBlock: false,
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
      Highlight.configure({
        multicolor: true
      }),
      FontFamily,
      FontSize,
      TextAlign.configure({
        types: ['heading', 'paragraph']
      }),
      TaskList,
      TaskItem.configure({
        nested: true
      }),
      // inline so an image can sit mid-paragraph, matching how
      // markdownToHtml embeds "![]()" wherever it appears in a line of text.
      ResizableImage.configure({
        inline: true
      }),
      VideoEmbed,
      CodeBlockWithCopy,
      Table.configure({
        resizable: true,
        View: TableViewWithEditButton
      }),
      TableRow,
      TableHeader,
      TableCell,
      TableMarkdownInputRule,
      Link.configure({
        openOnClick: false,
        // Left off on purpose: the extension ties its mark's `inclusive`
        // flag 1:1 to this option, so turning it on made every link
        // "inclusive" - text typed right after a link kept joining it
        // instead of starting fresh. Its live-scanning plugin also fought
        // the markdownLinks input rule below on the same keystroke, so
        // typing [text](url) never converted until the note was reloaded.
        // Links are still created via the toolbar, typed markdown syntax,
        // or pasting - just not from a bare URL typed inline.
        autolink: false,
        linkOnPaste: true,
        // Off by default in the extension: without it, typing markdown's
        // own [text](url) syntax leaves it as literal text instead of
        // converting it into a link as you finish typing it.
        markdownLinks: true,
        HTMLAttributes: {
          rel: 'noopener noreferrer',
          target: '_blank'
        }
      }),
      LinkMarkdownInputRule,
      // Converts a manually-typed "![alt](C:\local\path.png)" into a real,
      // vault-attached image the same way pasting/dropping one does - see
      // handlePaste below for the equivalent paste-as-text case.
      ImageMarkdownInputRule.configure({
        onLocalImagePath: async (sourceFilePath) => {
          if (!notePath) return null
          try {
            const relativePath = await window.api.vault.saveImageAttachment(
              notePath,
              sourceFilePath
            )
            return resolveNoteImageUrl(relativePath, notePath)
          } catch {
            return null
          }
        }
      }),
      // Registered after Link/LinkMarkdownInputRule so it runs after their
      // own auto-linking of the pasted URL - replacing the whole matched
      // range drops that link mark along with the rest of the text.
      VideoMarkdownInputRule
    ],
    editorProps: {
      handleClick: (_view, _pos, event) => {
        // openOnClick is off so a plain click just places the cursor
        // (needed to edit a link's own text) - Ctrl/Cmd+click is the
        // escape hatch to actually follow it, same convention as VS Code
        // and Notion. window.open goes through the app's existing
        // setWindowOpenHandler, which hands the URL to the OS browser
        // instead of a new Electron window.
        if (!(event.ctrlKey || event.metaKey)) return false
        const link = (event.target as HTMLElement)?.closest('a[href]')
        if (!link) return false
        event.preventDefault()
        window.open(link.getAttribute('href') || '', '_blank', 'noopener,noreferrer')
        return true
      },
      handlePaste: (_view, event) => {
        if (!notePath) return false
        const allFiles = Array.from(event.clipboardData?.files ?? [])
        const imageFiles = allFiles.filter((file) => file.type.startsWith('image/'))
        const videoFiles = allFiles.filter((file) => file.type.startsWith('video/'))
        if (imageFiles.length > 0 || videoFiles.length > 0) {
          event.preventDefault()
          imageFiles.forEach((file) => void insertImageFile(file, notePath))
          videoFiles.forEach((file) => void insertVideoFile(file, notePath))
          return true
        }

        // No actual image data on the clipboard - some tools instead copy
        // an image as its own Markdown reference text pointing at a local
        // file ("![alt](C:\path\to\file.png)"); only match that exact
        // shape (parenthesized path starting with a drive letter or a
        // leading slash) so a plain link or a remote image URL still
        // pastes as regular text/a link.
        const text = event.clipboardData?.getData('text/plain')?.trim()
        const match = text?.match(/^!\[([^\]]*)\]\(((?:[a-zA-Z]:[\\/]|\/)[^)]+)\)$/)
        if (match) {
          event.preventDefault()
          const [, alt, sourceFilePath] = match
          void insertImageFromPath(sourceFilePath, alt, notePath)
          return true
        }

        return false
      },
      handleDrop: (view, event) => {
        if (!notePath) return false
        const allFiles = Array.from(event.dataTransfer?.files ?? [])
        const imageFiles = allFiles.filter((file) => file.type.startsWith('image/'))
        const videoFiles = allFiles.filter((file) => file.type.startsWith('video/'))
        if (imageFiles.length === 0 && videoFiles.length === 0) return false
        event.preventDefault()
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos
        imageFiles.forEach((file) => void insertImageFile(file, notePath, pos))
        videoFiles.forEach((file) => void insertVideoFile(file, notePath, pos))
        return true
      }
    },
    content:
      noteExtension === '.txt'
        ? textToHtml(noteContent)
        : markdownToHtml(noteContent, notePath ?? ''),
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
      const convertedContent =
        noteExtension === '.txt' ? text : htmlToMarkdown(html, notePath ?? '')
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
      noteExtension === '.txt'
        ? textToHtml(noteContent)
        : markdownToHtml(noteContent, notePath ?? '')

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
        notePath={notePath}
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
