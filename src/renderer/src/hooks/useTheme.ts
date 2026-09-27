import { useEffect, useState } from 'react'

export const THEMES = [
  { id: 'vault-notes', label: 'Vault Notes', colors: ['#ff007f', '#00e5ff', '#060714'] },
  { id: 'tokyo-night', label: 'Tokyo Night', colors: ['#bb9af7', '#7dcfff', '#1a1b26'] },
  { id: 'catppuccin', label: 'Catppuccin', colors: ['#f5c2e7', '#89b4fa', '#1e1e2e'] },
  { id: 'nord', label: 'Nord', colors: ['#81a1c1', '#88c0d0', '#2e3440'] },
  { id: 'hackerman', label: 'Hackerman', colors: ['#00ff41', '#39ff14', '#050805'] },
  { id: 'dracula', label: 'Dracula', colors: ['#ff79c6', '#8be9fd', '#282a36'] }
] as const

export type ThemeId = (typeof THEMES)[number]['id']

const THEME_STORAGE_KEY = 'theme'
const DEFAULT_THEME: ThemeId = 'vault-notes'

const isValidTheme = (value: string | null): value is ThemeId =>
  !!value && THEMES.some((theme) => theme.id === value)

const applyTheme = (theme: ThemeId): void => {
  document.documentElement.setAttribute('data-theme', theme)
}

export const useTheme = (): { theme: ThemeId; setTheme: (theme: ThemeId) => void } => {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isValidTheme(stored) ? stored : DEFAULT_THEME
  })

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const setTheme = (next: ThemeId): void => {
    window.localStorage.setItem(THEME_STORAGE_KEY, next)
    setThemeState(next)
  }

  return { theme, setTheme }
}
