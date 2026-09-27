import React, { useEffect, useRef, useState } from 'react'
import { Star, FileText, Trash2, Download } from 'lucide-react'
import { NoteMetadata } from '../../types/vault'

interface NoteCardProps {
  note: NoteMetadata
  isActive: boolean
  onClick: () => void
  onToggleFavorite: (e: React.MouseEvent) => void
  onRename: (newTitle: string) => void
  onDelete: (permanent: boolean) => void
  onChangeExtension: (newExtension: 'md' | 'txt') => void
  onDownload: (extension: 'md' | 'txt') => void
}

export const NoteCard: React.FC<NoteCardProps> = ({
  note,
  isActive,
  onClick,
  onToggleFavorite,
  onRename,
  onDelete,
  onChangeExtension,
  onDownload
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState(note.title)
  const [openPopover, setOpenPopover] = useState<'extension' | 'download' | 'delete' | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const extPopoverRef = useRef<HTMLDivElement>(null)
  const downloadPopoverRef = useRef<HTMLDivElement>(null)
  const deletePopoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isEditing) {
      setDraftTitle(note.title)
    }
  }, [note.title, isEditing])

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [isEditing])

  useEffect(() => {
    if (!openPopover) return

    const handleClickOutside = (e: MouseEvent) => {
      const ref =
        openPopover === 'extension'
          ? extPopoverRef
          : openPopover === 'download'
            ? downloadPopoverRef
            : deletePopoverRef
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpenPopover(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openPopover])

  const targetExtension: 'md' | 'txt' = note.extension.toLowerCase() === '.md' ? 'txt' : 'md'

  const handleChangeExtension = (e: React.MouseEvent) => {
    e.stopPropagation()
    setOpenPopover(null)
    onChangeExtension(targetExtension)
  }

  const handleDownload = (e: React.MouseEvent, extension: 'md' | 'txt') => {
    e.stopPropagation()
    setOpenPopover(null)
    onDownload(extension)
  }

  const handleDelete = (e: React.MouseEvent, permanent: boolean) => {
    e.stopPropagation()
    setOpenPopover(null)
    onDelete(permanent)
  }

  const startEditing = (e: React.MouseEvent) => {
    e.stopPropagation()
    setDraftTitle(note.title)
    setIsEditing(true)
  }

  const commitEdit = () => {
    setIsEditing(false)
    const trimmed = draftTitle.trim()
    if (trimmed && trimmed !== note.title) {
      onRename(trimmed)
    } else {
      setDraftTitle(note.title)
    }
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitEdit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setDraftTitle(note.title)
      setIsEditing(false)
    }
  }

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div
      className={`note-card ${isActive ? 'active' : ''} ${openPopover ? 'has-open-popover' : ''}`}
      onClick={onClick}
    >
      <div className="note-card-header">
        <div className="note-card-title-group">
          <FileText className="note-type-icon" size={14} />
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              className="note-card-title-input"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={handleTitleKeyDown}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              className="note-card-title"
              onDoubleClick={startEditing}
              title="Duplo clique para renomear"
            >
              {note.title}
            </span>
          )}
        </div>
        <div className="note-ext-popover-wrap" ref={extPopoverRef}>
          <button
            className="note-card-ext"
            onClick={(e) => {
              e.stopPropagation()
              setOpenPopover(openPopover === 'extension' ? null : 'extension')
            }}
            title="Mudar extensão do arquivo"
          >
            {note.extension.toUpperCase()}
          </button>
          {openPopover === 'extension' && (
            <div className="note-card-popover note-ext-popover">
              <button className="note-card-popover-item" onClick={handleChangeExtension}>
                MUDAR PARA .{targetExtension.toUpperCase()}
              </button>
            </div>
          )}
        </div>
      </div>

      <p className="note-card-preview">{note.preview || 'Nenhum conteúdo...'}</p>

      <div className="note-card-footer">
        <span className="note-card-date">{formatTime(note.createdAt)}</span>
        <div className="note-card-actions">
          <div className="note-download-popover-wrap" ref={downloadPopoverRef}>
            <button
              className="note-card-download-btn"
              onClick={(e) => {
                e.stopPropagation()
                setOpenPopover(openPopover === 'download' ? null : 'download')
              }}
              title="Baixar cópia da nota"
            >
              <Download size={14} />
            </button>
            {openPopover === 'download' && (
              <div className="note-card-popover note-download-popover">
                <button className="note-card-popover-item" onClick={(e) => handleDownload(e, 'md')}>
                  BAIXAR .MD
                </button>
                <button
                  className="note-card-popover-item"
                  onClick={(e) => handleDownload(e, 'txt')}
                >
                  BAIXAR .TXT
                </button>
              </div>
            )}
          </div>
          <button
            className={`favorite-btn ${note.isFavorite ? 'is-favorite' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              onToggleFavorite(e)
            }}
            title={note.isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
          >
            <Star size={14} fill={note.isFavorite ? 'var(--pink-neon)' : 'transparent'} />
          </button>
          <div className="note-delete-popover-wrap" ref={deletePopoverRef}>
            <button
              className="note-card-delete-btn"
              onClick={(e) => {
                e.stopPropagation()
                setOpenPopover(openPopover === 'delete' ? null : 'delete')
              }}
              title="Excluir Nota"
            >
              <Trash2 size={14} />
            </button>
            {openPopover === 'delete' && (
              <div className="note-card-popover note-delete-popover">
                <button className="note-card-popover-item" onClick={(e) => handleDelete(e, false)}>
                  MOVER PARA LIXEIRA
                </button>
                <button
                  className="note-card-popover-item danger"
                  onClick={(e) => handleDelete(e, true)}
                >
                  EXCLUIR PERMANENTEMENTE
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default NoteCard
