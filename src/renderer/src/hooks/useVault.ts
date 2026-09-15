import { useState, useEffect, useCallback } from 'react'
import { VaultState } from '../types/vault'

export const useVault = () => {
  const [vaultState, setVaultState] = useState<VaultState>({
    activeVaultPath: null,
    vaults: [],
    favorites: []
  })
  const [isLoading, setIsLoading] = useState(true)

  const fetchVaultState = useCallback(async () => {
    setIsLoading(true)
    try {
      const state = await window.api.vault.getActiveVault()
      setVaultState(state)
    } catch (error) {
      console.error('Failed to get active vault:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchVaultState()
  }, [fetchVaultState])

  const selectVaultFolder = useCallback(async () => {
    try {
      const state = await window.api.vault.selectFolder()
      if (state) {
        setVaultState(state)
      }
    } catch (error) {
      console.error('Failed to select vault folder:', error)
    }
  }, [])

  const selectActiveVault = useCallback(async (path: string) => {
    try {
      const state = await window.api.vault.setActiveVault(path)
      setVaultState(state)
    } catch (error) {
      console.error('Failed to set active vault:', error)
    }
  }, [])

  const removeVault = useCallback(async (path: string) => {
    try {
      const state = await window.api.vault.removeVault(path)
      setVaultState(state)
      return state
    } catch (error) {
      console.error('Failed to remove vault:', error)
      return null
    }
  }, [])

  return {
    vaultState,
    isLoading,
    selectVaultFolder,
    selectActiveVault,
    removeVault,
    refreshVaultState: fetchVaultState
  }
}

export default useVault
