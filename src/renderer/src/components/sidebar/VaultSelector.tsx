import React, { useState, useRef, useEffect } from 'react'
import { Folder, ChevronDown, Plus, FolderOpen, Trash2 } from 'lucide-react'
import { VaultState } from '../../types/vault'

interface VaultSelectorProps {
  vaultState: VaultState
  onSelectVault: (path: string) => void
  onAddVault: () => void
  onRemoveVault: (path: string) => void
}

export const VaultSelector: React.FC<VaultSelectorProps> = ({
  vaultState,
  onSelectVault,
  onAddVault,
  onRemoveVault
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const activeVaultName = vaultState.activeVaultPath
    ? vaultState.activeVaultPath.split(/[\\/]/).pop() || 'Vault'
    : 'Sem Vault'

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleOpenFolder = (e: React.MouseEvent, vaultPath: string) => {
    e.stopPropagation()
    window.api.vault.openFolder(vaultPath)
  }

  const handleRemoveVault = (e: React.MouseEvent, vaultPath: string) => {
    e.stopPropagation()
    onRemoveVault(vaultPath)
  }

  return (
    <div className="vault-selector-container" ref={dropdownRef}>
      <button className="vault-selector-trigger" onClick={() => setIsOpen(!isOpen)}>
        <div className="vault-trigger-info">
          <Folder className="vault-folder-icon" size={16} />
          <span className="vault-active-name" title={vaultState.activeVaultPath || ''}>
            {activeVaultName.toUpperCase()}
          </span>
        </div>
        <ChevronDown size={14} className={`vault-chevron ${isOpen ? 'open' : ''}`} />
      </button>

      {isOpen && (
        <div className="vault-dropdown">
          <div className="vault-dropdown-header">SEUS VAULTS</div>
          <div className="vault-list">
            {vaultState.vaults.map((vaultPath) => {
              const isSelected = vaultPath === vaultState.activeVaultPath
              const vaultName = vaultPath.split(/[\\/]/).pop() || vaultPath
              return (
                <div
                  key={vaultPath}
                  className={`vault-item ${isSelected ? 'active' : ''}`}
                  title={vaultPath}
                >
                  <button
                    className="vault-item-open-btn"
                    onClick={(e) => handleOpenFolder(e, vaultPath)}
                    title="Abrir pasta no explorador"
                  >
                    <FolderOpen size={12} />
                  </button>
                  <button
                    className="vault-item-select-btn"
                    onClick={() => {
                      onSelectVault(vaultPath)
                      setIsOpen(false)
                    }}
                  >
                    <span className="vault-item-name">{vaultName}</span>
                  </button>
                  <button
                    className="vault-item-remove-btn"
                    onClick={(e) => handleRemoveVault(e, vaultPath)}
                    title="Remover vault da lista"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )
            })}
          </div>
          <div className="vault-dropdown-divider"></div>
          <button
            className="vault-add-btn"
            onClick={() => {
              onAddVault()
              setIsOpen(false)
            }}
          >
            <Plus size={14} />
            <span>ADICIONAR VAULT</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default VaultSelector
