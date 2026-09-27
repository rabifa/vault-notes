import React, { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { Editor } from '@tiptap/react'
import { Copy, Minus, Plus, MoreHorizontal } from 'lucide-react'

import sidebarEnableIcon from '../../assets/icons/sidebar-anable-icon.svg'
import sidebarDisableIcon from '../../assets/icons/sidebar-disable-icon.svg'
import trashIcon from '../../assets/icons/trash-icon.svg'
import newNoteIcon from '../../assets/icons/new-note-icon.svg'
import checklistIcon from '../../assets/icons/checklist-icon.svg'
import fontEditIcon from '../../assets/icons/font-edit-icon.svg'
import highlighterIcon from '../../assets/icons/highlighter-icon.svg'
import boldIcon from '../../assets/icons/bold-icon.svg'
import italicIcon from '../../assets/icons/italic-icon.svg'
import underscoreIcon from '../../assets/icons/underscore-icon.svg'
import alignLeftIcon from '../../assets/icons/align-left-icon.svg'
import alignCenterIcon from '../../assets/icons/align-center-icon.svg'
import alignRightIcon from '../../assets/icons/align-right-icon.svg'
import SvgIcon from '../common/SvgIcon'

interface EditorToolbarProps {
  editor: Editor | null
  onToggleSidebar?: () => void
  onDeleteNote?: (permanent: boolean) => void
  onDuplicateNote?: () => void
  onCreateNote?: () => void
  isSidebarOpen?: boolean
}

const FONTS = [
  { name: 'Inter', value: 'Inter, sans-serif' },
  { name: 'Orbitron', value: 'Orbitron, sans-serif' },
  { name: 'JetBrains Mono', value: 'var(--font-family-mono), monospace' },
  { name: 'Arial', value: 'Arial, sans-serif' }
]

const DEFAULT_FONT_SIZE = 16
const MIN_FONT_SIZE = 8
const MAX_FONT_SIZE = 72

// Pasted content often carries colors as rgb()/rgba() strings, which the
// highlighter icon preview only understands as hex.
const toHexColor = (color: string): string => {
  if (/^#[0-9a-f]{6}$/i.test(color)) return color
  const match = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
  if (match) {
    const [, r, g, b] = match
    return `#${[r, g, b].map((c) => Number(c).toString(16).padStart(2, '0')).join('')}`
  }
  return '#ffffff'
}

const NEON_COLORS = [
  { name: 'White', value: '#ffffff' },
  { name: 'Pink Neon', value: '#ff007f' },
  { name: 'Cyan Neon', value: '#00e5ff' },
  { name: 'Green Neon', value: '#00ff66' },
  { name: 'Yellow Neon', value: '#ffcc00' },
  { name: 'Purple Neon', value: '#a020f0' },
  { name: 'Muted Grey', value: '#6b7a99' },
  { name: 'Orange Neon', value: '#ff5e00' }
]

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  editor,
  onToggleSidebar,
  onDeleteNote,
  onDuplicateNote,
  onCreateNote,
  isSidebarOpen = true
}) => {
  const [isFontOpen, setIsFontOpen] = useState(false)
  const [isColorOpen, setIsColorOpen] = useState(false)
  const [isOverflowOpen, setIsOverflowOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [fontSizeDraft, setFontSizeDraft] = useState(DEFAULT_FONT_SIZE)
  // Which of the two least-essential groups (text formatting, alignment)
  // have been moved into the overflow "more tools" dropdown because they
  // no longer fit in the toolbar's current width.
  const [collapsed, setCollapsed] = useState({ group3: false, group4: false })
  const fontRef = useRef<HTMLDivElement>(null)
  const colorRef = useRef<HTMLDivElement>(null)
  const overflowRef = useRef<HTMLDivElement>(null)
  const deleteRef = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const group3Ref = useRef<HTMLDivElement>(null)
  const group4Ref = useRef<HTMLDivElement>(null)
  const divider3Ref = useRef<HTMLDivElement>(null)
  const divider4Ref = useRef<HTMLDivElement>(null)
  const fontSizeSelectionRef = useRef<{ from: number; to: number } | null>(null)
  const overflowMeasurementsRef = useRef<{
    essentialWidth: number
    divider3Width: number
    group3Width: number
    divider4Width: number
    group4Width: number
  } | null>(null)

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (fontRef.current && !fontRef.current.contains(e.target as Node)) {
        setIsFontOpen(false)
      }
      if (colorRef.current && !colorRef.current.contains(e.target as Node)) {
        setIsColorOpen(false)
      }
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setIsOverflowOpen(false)
      }
      if (deleteRef.current && !deleteRef.current.contains(e.target as Node)) {
        setIsDeleteOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  // Text formatting and alignment are the least essential groups, so
  // they're the ones that move into a "more tools" dropdown when the
  // toolbar doesn't have room for everything - rather than letting icons
  // wrap onto a second line or spill past the panel's edge. Their widths
  // are fixed (same buttons every render), so measure them once up front
  // and reuse that on every resize instead of re-measuring each time.
  const OVERFLOW_BTN_RESERVE = 36

  const evaluateOverflow = () => {
    const toolbar = toolbarRef.current
    const m = overflowMeasurementsRef.current
    if (!toolbar || !m) return
    const available = toolbar.clientWidth
    const fullWidth =
      m.essentialWidth + m.divider3Width + m.group3Width + m.divider4Width + m.group4Width

    if (fullWidth <= available) {
      setCollapsed({ group3: false, group4: false })
      return
    }
    const withGroup3Only = m.essentialWidth + m.divider3Width + m.group3Width + OVERFLOW_BTN_RESERVE
    if (withGroup3Only <= available) {
      setCollapsed({ group3: false, group4: true })
      return
    }
    setCollapsed({ group3: true, group4: true })
  }

  // Measures once (pre-paint, so a narrow initial window doesn't flash
  // everything visible first) and immediately evaluates so the first
  // paint already reflects the right collapsed state.
  useLayoutEffect(() => {
    if (overflowMeasurementsRef.current) return
    const toolbar = toolbarRef.current
    const group3 = group3Ref.current
    const group4 = group4Ref.current
    const divider3 = divider3Ref.current
    const divider4 = divider4Ref.current
    if (!toolbar || !group3 || !group4 || !divider3 || !divider4) return

    const group3Width = group3.offsetWidth
    const group4Width = group4.offsetWidth
    const divider3Width = divider3.offsetWidth
    const divider4Width = divider4.offsetWidth
    overflowMeasurementsRef.current = {
      essentialWidth:
        toolbar.scrollWidth - divider3Width - group3Width - divider4Width - group4Width,
      divider3Width,
      group3Width,
      divider4Width,
      group4Width
    }
    evaluateOverflow()
  }, [])

  useEffect(() => {
    const toolbar = toolbarRef.current
    if (!toolbar) return
    const observer = new ResizeObserver(evaluateOverflow)
    observer.observe(toolbar)
    return () => observer.disconnect()
  }, [])

  // The slider/stepper own their displayed value locally instead of
  // re-reading editor.getAttributes() on every render: that read reflects
  // whatever is under the (possibly mixed) selection and can disagree with
  // what was just set, which fights a controlled <input type="range"> mid-drag.
  // Sync the draft once when the dropdown opens, then let the controls drive it.
  //
  // Also snapshot the selection at that moment: focusing the range input
  // makes the browser drop the native text selection, and once that
  // happens the editor has nothing left to apply the size to. Re-applying
  // this stored range before every change sidesteps that entirely.
  useEffect(() => {
    if (!isFontOpen || !editor) return
    const raw = editor.getAttributes('textStyle').fontSize as string | undefined
    const parsed = raw ? parseInt(raw, 10) : NaN
    setFontSizeDraft(Number.isFinite(parsed) ? parsed : DEFAULT_FONT_SIZE)
    fontSizeSelectionRef.current = {
      from: editor.state.selection.from,
      to: editor.state.selection.to
    }
  }, [isFontOpen, editor])

  if (!editor) return null

  const getActiveColor = () => {
    const attrs = editor.getAttributes('textStyle')
    return toHexColor(attrs.color || '#ffffff')
  }

  const setFont = (fontValue: string) => {
    editor.chain().focus().setFontFamily(fontValue).run()
    setIsFontOpen(false)
  }

  const fontSizeSliderFillPercent =
    ((fontSizeDraft - MIN_FONT_SIZE) / (MAX_FONT_SIZE - MIN_FONT_SIZE)) * 100

  // Never chains .focus() here: stealing DOM focus back to the editor mid-drag
  // is what made the range input's native drag gesture break intermittently.
  // Re-asserting the stored selection (see the effect above) is what makes
  // this keep applying to the right text even after the browser has visibly
  // dropped the selection because focus moved to the slider.
  const applyFontSize = (next: number) => {
    const clamped = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, next))
    setFontSizeDraft(clamped)
    const sel = fontSizeSelectionRef.current
    const chain = editor.chain()
    if (sel && sel.from !== sel.to) {
      chain.setTextSelection(sel)
    }
    chain.setFontSize(`${clamped}px`).run()
  }

  const adjustFontSize = (delta: number) => applyFontSize(fontSizeDraft + delta)

  // Re-asserts the selection captured when the dropdown opened before
  // applying the color - see the effect above for why that's necessary.
  // Predefined colors don't need the selection to stay highlighted
  // afterward - apply the mark, then collapse the selection to its end
  // so the cursor just sits after the now-colored text.
  const setColor = (colorValue: string) => {
    const { to } = editor.state.selection
    editor.chain().focus().setColor(colorValue).setTextSelection(to).run()
    setIsColorOpen(false)
  }

  const boldButton = (
    <button
      className={`toolbar-btn ${editor.isActive('bold') ? 'active' : ''}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => editor.chain().focus().toggleBold().run()}
      title="Negrito"
    >
      <SvgIcon src={boldIcon} size={15} alt="Negrito" />
    </button>
  )
  const italicButton = (
    <button
      className={`toolbar-btn ${editor.isActive('italic') ? 'active' : ''}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => editor.chain().focus().toggleItalic().run()}
      title="Itálico"
    >
      <SvgIcon src={italicIcon} size={15} alt="Itálico" />
    </button>
  )
  const underlineButton = (
    <button
      className={`toolbar-btn ${editor.isActive('underline') ? 'active' : ''}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => editor.chain().focus().toggleUnderline().run()}
      title="Sublinhado"
    >
      <SvgIcon src={underscoreIcon} size={15} alt="Sublinhado" />
    </button>
  )
  const alignLeftButton = (
    <button
      className={`toolbar-btn ${editor.isActive({ textAlign: 'left' }) ? 'active' : ''}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => editor.chain().focus().setTextAlign('left').run()}
      title="Alinhar à Esquerda"
    >
      <SvgIcon src={alignLeftIcon} size={15} alt="Alinhar à Esquerda" />
    </button>
  )
  const alignCenterButton = (
    <button
      className={`toolbar-btn ${editor.isActive({ textAlign: 'center' }) ? 'active' : ''}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => editor.chain().focus().setTextAlign('center').run()}
      title="Centralizar"
    >
      <SvgIcon src={alignCenterIcon} size={15} alt="Centralizar" />
    </button>
  )
  const alignRightButton = (
    <button
      className={`toolbar-btn ${editor.isActive({ textAlign: 'right' }) ? 'active' : ''}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => editor.chain().focus().setTextAlign('right').run()}
      title="Alinhar à Direita"
    >
      <SvgIcon src={alignRightIcon} size={15} alt="Alinhar à Direita" />
    </button>
  )

  const hasOverflow = collapsed.group3 || collapsed.group4

  return (
    <div className="editor-toolbar" ref={toolbarRef}>
      {/* Group 1: Sidebar & File Management */}
      <div className="toolbar-group">
        <button
          className={`toolbar-btn ${isSidebarOpen ? 'active' : ''}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={onToggleSidebar}
          title={isSidebarOpen ? 'Esconder Barra Lateral' : 'Mostrar Barra Lateral'}
        >
          <SvgIcon
            src={isSidebarOpen ? sidebarEnableIcon : sidebarDisableIcon}
            size={15}
            alt="Sidebar"
          />
        </button>
        <div className="dropdown-container" ref={deleteRef}>
          <button
            className={`toolbar-btn ${isDeleteOpen ? 'active' : ''}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setIsDeleteOpen(!isDeleteOpen)}
            title="Excluir Nota"
          >
            <SvgIcon src={trashIcon} size={15} alt="Excluir" />
          </button>
          {isDeleteOpen && (
            <div className="dropdown-menu delete-dropdown">
              <button
                className="dropdown-item"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setIsDeleteOpen(false)
                  onDeleteNote?.(false)
                }}
              >
                MOVER PARA LIXEIRA
              </button>
              <button
                className="dropdown-item danger"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setIsDeleteOpen(false)
                  onDeleteNote?.(true)
                }}
              >
                EXCLUIR PERMANENTEMENTE
              </button>
            </div>
          )}
        </div>
        <button
          className="toolbar-btn"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onDuplicateNote}
          title="Duplicar Nota"
        >
          <Copy size={15} />
        </button>
        <button
          className="toolbar-btn"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onCreateNote}
          title="Nova Nota"
        >
          <SvgIcon src={newNoteIcon} size={15} alt="Nova Nota" />
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Group 2: Typography, Color & Checklist */}
      <div className="toolbar-group">
        <button
          className={`toolbar-btn ${editor.isActive('taskList') ? 'active' : ''}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          title="Lista de Tarefas"
        >
          <SvgIcon src={checklistIcon} size={15} alt="Checklist" />
        </button>

        {/* Font Family Dropdown */}
        <div className="dropdown-container" ref={fontRef}>
          <button
            className={`toolbar-btn ${isFontOpen ? 'active' : ''}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setIsFontOpen(!isFontOpen)}
            title="Família de Fonte"
          >
            <SvgIcon src={fontEditIcon} size={15} alt="Fonte" />
          </button>
          {isFontOpen && (
            <div className="dropdown-menu font-dropdown">
              <div className="font-size-control">
                <button
                  className="font-size-btn"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => adjustFontSize(-1)}
                  title="Diminuir tamanho da fonte"
                >
                  <Minus size={12} />
                </button>
                <span className="font-size-value">{fontSizeDraft}px</span>
                <button
                  className="font-size-btn"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => adjustFontSize(1)}
                  title="Aumentar tamanho da fonte"
                >
                  <Plus size={12} />
                </button>
              </div>
              <input
                type="range"
                className="font-size-slider"
                min={MIN_FONT_SIZE}
                max={MAX_FONT_SIZE}
                value={fontSizeDraft}
                style={{
                  background: `linear-gradient(to right, var(--cyan-neon) ${fontSizeSliderFillPercent}%, var(--bg-control) ${fontSizeSliderFillPercent}%)`
                }}
                onChange={(e) => applyFontSize(Number(e.target.value))}
              />
              <div className="dropdown-divider-thin" />
              {FONTS.map((font) => (
                <button
                  key={font.name}
                  className={`dropdown-item ${
                    editor.isActive('textStyle', { fontFamily: font.value }) ? 'active' : ''
                  }`}
                  style={{ fontFamily: font.value }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setFont(font.value)}
                >
                  {font.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Color Dropdown */}
        <div className="dropdown-container" ref={colorRef}>
          <button
            className={`toolbar-btn ${isColorOpen ? 'active' : ''}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setIsColorOpen(!isColorOpen)}
            title="Cor da Fonte"
          >
            <SvgIcon
              src={highlighterIcon}
              size={15}
              alt="Cor"
              style={{ color: getActiveColor() }}
            />
          </button>
          {isColorOpen && (
            <div className="dropdown-menu color-dropdown">
              <div className="color-palette">
                {NEON_COLORS.map((color) => {
                  const isActive = editor.isActive('textStyle', { color: color.value })
                  return (
                    <button
                      key={color.name}
                      className={`color-swatch ${isActive ? 'active' : ''}`}
                      style={{ backgroundColor: color.value }}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setColor(color.value)}
                      title={color.name}
                    />
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {!collapsed.group3 && <div className="toolbar-divider" ref={divider3Ref} />}

      {/* Group 3: Text Formatting */}
      {!collapsed.group3 && (
        <div className="toolbar-group" ref={group3Ref}>
          {boldButton}
          {italicButton}
          {underlineButton}
        </div>
      )}

      {!collapsed.group4 && <div className="toolbar-divider" ref={divider4Ref} />}

      {/* Group 4: Text Alignment */}
      {!collapsed.group4 && (
        <div className="toolbar-group" ref={group4Ref}>
          {alignLeftButton}
          {alignCenterButton}
          {alignRightButton}
        </div>
      )}

      {hasOverflow && (
        <div className="dropdown-container toolbar-overflow" ref={overflowRef}>
          <button
            className={`toolbar-btn ${isOverflowOpen ? 'active' : ''}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setIsOverflowOpen(!isOverflowOpen)}
            title="Mais Ferramentas"
          >
            <MoreHorizontal size={15} />
          </button>
          {isOverflowOpen && (
            <div className="dropdown-menu toolbar-overflow-menu">
              {collapsed.group3 && (
                <div className="toolbar-group">
                  {boldButton}
                  {italicButton}
                  {underlineButton}
                </div>
              )}
              {collapsed.group4 && (
                <div className="toolbar-group">
                  {alignLeftButton}
                  {alignCenterButton}
                  {alignRightButton}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default EditorToolbar
