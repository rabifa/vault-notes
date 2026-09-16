import React, { useEffect, useRef, useState } from 'react'
import { Star, FileText, Trash2 } from 'lucide-react'
import { NoteMetadata } from '../../types/vault'

interface NoteCardProps {
  note: NoteMetadata
  isActive: boolean
  onClick: () => void
  onToggleFavorite: (e: React.MouseEvent) => void
  onRename: (newTitle: string) => void
  onDelete: () => void
}

export const NoteCard: React.FC<NoteCardProps> = ({
  note,
  isActive,
  onClick,
  onToggleFavorite,
  onRename,
  onDelete
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState(note.title)
  const inputRef = useRef<HTMLInputElement>(null)

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
    <div className={`note-card ${isActive ? 'active' : ''}`} onClick={onClick}>
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
            <span className="note-card-title" onDoubleClick={startEditing} title="Duplo clique para renomear">
              {note.title}
            </span>
          )}
        </div>
        <span className="note-card-ext">{note.extension.toUpperCase()}</span>
      </div>

      <p className="note-card-preview">{note.preview || 'Nenhum conteúdo...'}</p>

      <div className="note-card-footer">
        <span className="note-card-date">{formatTime(note.createdAt)}</span>
        <div className="note-card-actions">
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
          <button
            className="note-card-delete-btn"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            title="Excluir Nota"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default NoteCard
