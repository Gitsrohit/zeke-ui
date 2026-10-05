"use client";

import { create } from "zustand";

/** Cross-cutting UI state: overlays that can be opened from anywhere (topbar, shortcuts, pages). */
interface UiState {
  commandOpen: boolean;
  assistantOpen: boolean;
  assistantPrompt: string | null;
  mobileNavOpen: boolean;
  setCommandOpen: (open: boolean) => void;
  openAssistant: (prompt?: string) => void;
  closeAssistant: () => void;
  setMobileNavOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  commandOpen: false,
  assistantOpen: false,
  assistantPrompt: null,
  mobileNavOpen: false,
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  openAssistant: (prompt) => set({ assistantOpen: true, assistantPrompt: prompt ?? null }),
  closeAssistant: () => set({ assistantOpen: false, assistantPrompt: null }),
  setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
}));
