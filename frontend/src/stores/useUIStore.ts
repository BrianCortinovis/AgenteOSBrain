import { create } from 'zustand';

type View = 'mappa' | 'agenti' | 'automazioni' | 'prompt' | 'connettori' | 'risultati' | 'impostazioni' | 'workspace' | 'timeline' | 'dashboard';

interface UIState {
  currentView: View;
  sidebarOpen: boolean;
  chatOpen: boolean;
  inspectorOpen: boolean;
  setView: (view: View) => void;
  toggleSidebar: () => void;
  toggleChat: () => void;
  toggleInspector: () => void;
  setInspectorOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  currentView: 'mappa',
  sidebarOpen: true,
  chatOpen: true,
  inspectorOpen: false,

  setView: (view) => set({ currentView: view }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleChat: () => set((s) => ({ chatOpen: !s.chatOpen })),
  toggleInspector: () => set((s) => ({ inspectorOpen: !s.inspectorOpen })),
  setInspectorOpen: (open) => set({ inspectorOpen: open }),
}));
