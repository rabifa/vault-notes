import React, { useRef, useState, useEffect } from 'react'
import { Palette, Check } from 'lucide-react'
import { THEMES, useTheme } from '../../hooks/useTheme'

export const ThemeSwitcher: React.FC = () => {
  const { theme, setTheme } = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="theme-switcher-container" ref={dropdownRef}>
      <button className="theme-switcher-trigger" onClick={() => setIsOpen(!isOpen)} title="Temas">
        <Palette size={16} />
      </button>

      {isOpen && (
        <div className="theme-dropdown">
          <div className="theme-dropdown-header">TEMAS</div>
          <div className="theme-list">
            {THEMES.map((item) => (
              <button
                key={item.id}
                className={`theme-item ${theme === item.id ? 'active' : ''}`}
                onClick={() => {
                  setTheme(item.id)
                  setIsOpen(false)
                }}
              >
                <span className="theme-item-swatch">
                  {item.colors.map((color, index) => (
                    <span
                      key={index}
                      className="theme-item-swatch-dot"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </span>
                <span className="theme-item-name">{item.label}</span>
                {theme === item.id && <Check size={12} className="theme-item-check" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default ThemeSwitcher
