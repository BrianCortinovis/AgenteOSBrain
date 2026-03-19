import { create } from 'zustand';

type View = 'work' | 'agenti' | 'automazioni' | 'prompt' | 'connettori' | 'risultati' | 'impostazioni' | 'workspace' | 'timeline' | 'dashboard' | 'builder';

export type IAOSWindowType = 'builder' | 'work' | 'work-graph' | 'app-gallery' | 'app-preview' | 'processes' | 'settings' | 'agenti' | 'timeline' | 'risultati' | 'connettori' | 'import' | 'file-viewer' | 'files' | 'browser' | 'brianmap';

export type IAOSWindow = {
  id: string;
  title: string;
  component: IAOSWindowType;
  props?: Record<string, any>;
  position: { x: number; y: number };
  size: { w: number; h: number };
  minimized: boolean;
  zIndex: number;
};

interface UIState {
  currentView: View;
  sidebarOpen: boolean;
  chatOpen: boolean;
  inspectorOpen: boolean;
  iaosMode: boolean;
  iaosWindows: IAOSWindow[];
  iaosChatOpen: boolean;
  iaosNextZ: number;
  flowPendingFile: { name: string; content: string } | null;

  setView: (view: View) => void;
  toggleSidebar: () => void;
  toggleChat: () => void;
  toggleInspector: () => void;
  setInspectorOpen: (open: boolean) => void;
  setIaosMode: (on: boolean) => void;
  toggleIaosChat: () => void;
  setFlowPendingFile: (file: { name: string; content: string } | null) => void;

  // Window manager
  openWindow: (component: IAOSWindowType, title: string, props?: Record<string, any>) => void;
  closeWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  moveWindow: (id: string, x: number, y: number) => void;
  resizeWindow: (id: string, w: number, h: number) => void;
}

let windowCounter = 0;

export const useUIStore = create<UIState>((set, get) => ({
  currentView: 'work',
  sidebarOpen: true,
  chatOpen: true,
  inspectorOpen: false,
  iaosMode: false,
  iaosWindows: [],
  iaosChatOpen: true,
  iaosNextZ: 10,
  flowPendingFile: null,

  setView: (view) => set({ currentView: view }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleChat: () => set((s) => ({ chatOpen: !s.chatOpen })),
  toggleInspector: () => set((s) => ({ inspectorOpen: !s.inspectorOpen })),
  setInspectorOpen: (open) => set({ inspectorOpen: open }),
  setIaosMode: (on) => set({ iaosMode: on }),
  toggleIaosChat: () => set((s) => ({ iaosChatOpen: !s.iaosChatOpen })),
  setFlowPendingFile: (file) => set({ flowPendingFile: file }),

  openWindow: (component, title, props) => {
    const existing = get().iaosWindows.find(w => w.component === component && !w.props?.appName);
    if (existing && component !== 'app-preview') {
      // Focus existing window instead of opening duplicate
      get().focusWindow(existing.id);
      if (existing.minimized) {
        set(s => ({ iaosWindows: s.iaosWindows.map(w => w.id === existing.id ? { ...w, minimized: false } : w) }));
      }
      return;
    }
    const id = `win_${++windowCounter}`;
    const offset = (windowCounter % 8) * 30;
    const z = get().iaosNextZ;
    const win: IAOSWindow = {
      id, title, component, props,
      position: { x: 280 + offset, y: 60 + offset },
      size: { w: 900, h: 600 },
      minimized: false,
      zIndex: z,
    };
    set(s => ({ iaosWindows: [...s.iaosWindows, win], iaosNextZ: z + 1 }));
  },

  closeWindow: (id) => set(s => ({ iaosWindows: s.iaosWindows.filter(w => w.id !== id) })),

  minimizeWindow: (id) => set(s => ({
    iaosWindows: s.iaosWindows.map(w => w.id === id ? { ...w, minimized: !w.minimized } : w),
  })),

  focusWindow: (id) => {
    const z = get().iaosNextZ;
    set(s => ({
      iaosWindows: s.iaosWindows.map(w => w.id === id ? { ...w, zIndex: z, minimized: false } : w),
      iaosNextZ: z + 1,
    }));
  },

  moveWindow: (id, x, y) => set(s => ({
    iaosWindows: s.iaosWindows.map(w => w.id === id ? { ...w, position: { x, y } } : w),
  })),

  resizeWindow: (id, width, height) => set(s => ({
    iaosWindows: s.iaosWindows.map(win => win.id === id ? { ...win, size: { w: width, h: height } } : win),
  })),
}));
