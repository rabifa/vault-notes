import React, { useEffect, useRef, useState } from 'react'
import { ArrowUpDown } from 'lucide-react'
import { NotesSortOption } from '../../hooks/useNotes'

interface SortButtonProps {
  sortOption: NotesSortOption
  onChange: (option: NotesSortOption) => void
}

const OPTIONS: { value: NotesSortOption; label: string }[] = [
  { value: 'title-asc', label: 'A-Z' },
  { value: 'title-desc', label: 'Z-A' },
  { value: 'created-desc', label: 'CRIADA: MAIS RECENTE' },
  { value: 'created-asc', label: 'CRIADA: MAIS ANTIGA' }
]

export const SortButton: React.FC<SortButtonProps> = ({ sortOption, onChange }) => {
  const [isOpen, setIsOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  return (
    <div className="sort-btn-wrap" ref={wrapRef}>
      <button
        className="sidebar-close-btn"
        onClick={() => setIsOpen((prev) => !prev)}
        title="Ordenar notas"
      >
        <ArrowUpDown size={16} />
      </button>
      {isOpen && (
        <div className="note-card-popover sort-popover">
          {OPTIONS.map((option) => (
            <button
              key={option.value}
              className={`note-card-popover-item ${sortOption === option.value ? 'active' : ''}`}
              onClick={() => {
                onChange(option.value)
                setIsOpen(false)
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default SortButton
