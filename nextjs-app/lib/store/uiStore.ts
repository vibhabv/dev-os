import { create } from 'zustand'

interface UiState {
  targetPage: number | null
  setTargetPage: (page: number | null) => void
  wizardStep: number
  setWizardStep: (step: number) => void
  resetWizard: () => void
}

export const useUiStore = create<UiState>((set) => ({
  targetPage: null,
  setTargetPage: (page) => set({ targetPage: page }),
  wizardStep: 0,
  setWizardStep: (step) => set({ wizardStep: step }),
  resetWizard: () => set({ wizardStep: 0 }),
}))
