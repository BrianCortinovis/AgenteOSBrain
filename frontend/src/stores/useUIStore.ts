import { create } from 'zustand';

type View = 'work' | 'agenti' | 'automazioni' | 'prompt' | 'connettori' | 'risultati' | 'impostazioni' | 'workspace' | 'timeline' | 'dashboard' | 'builder';

export type FlowWindowType = 'builder' | 'work' | 'work-graph' | 'app-gallery' | 'app-preview' | 'processes' | 'settings' | 'agenti' | 'timeline' | 'risultati' | 'connettori' | 'import' | 'file-viewer' | 'files' | 'browser' | 'brianmap' | 'docanalyzer';

export type FlowWindow = {
  id: string;
  title: string;
  component: FlowWindowType;
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
  flowMode: boolean;
  flowWindows: FlowWindow[];
  flowChatOpen: boolean;
  flowNextZ: number;
  flowPendingFile: { name: string; content: string } | null;

  setView: (view: View) => void;
  toggleSidebar: () => void;
  toggleChat: () => void;
  toggleInspector: () => void;
  setInspectorOpen: (open: boolean) => void;
  setFlowMode: (on: boolean) => void;
  toggleFlowChat: () => void;
  setFlowPendingFile: (file: { name: string; content: string } | null) => void;

  // Window manager
  openWindow: (component: FlowWindowType, title: string, props?: Record<string, any>) => void;
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
  flowMode: false,
  flowWindows: [],
  flowChatOpen: true,
  flowNextZ: 10,
  flowPendingFile: null,

  setView: (view) => set({ currentView: view }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleChat: () => set((s) => ({ chatOpen: !s.chatOpen })),
  toggleInspector: () => set((s) => ({ inspectorOpen: !s.inspectorOpen })),
  setInspectorOpen: (open) => set({ inspectorOpen: open }),
  setFlowMode: (on) => set({ flowMode: on }),
  toggleFlowChat: () => set((s) => ({ flowChatOpen: !s.flowChatOpen })),
  setFlowPendingFile: (file) => set({ flowPendingFile: file }),

  openWindow: (component, title, props) => {
    const existing = get().flowWindows.find(w => w.component === component && !w.props?.appName);
    if (existing && component !== 'app-preview') {
      // Focus existing window instead of opening duplicate
      get().focusWindow(existing.id);
      if (existing.minimized) {
        set(s => ({ flowWindows: s.flowWindows.map(w => w.id === existing.id ? { ...w, minimized: false } : w) }));
      }
      return;
    }
    const id = `win_${++windowCounter}`;
    const offset = (windowCounter % 8) * 30;
    const z = get().flowNextZ;
    const win: FlowWindow = {
      id, title, component, props,
      position: { x: 280 + offset, y: 60 + offset },
      size: { w: 900, h: 600 },
      minimized: false,
      zIndex: z,
    };
    set(s => ({ flowWindows: [...s.flowWindows, win], flowNextZ: z + 1 }));
  },

  closeWindow: (id) => set(s => ({ flowWindows: s.flowWindows.filter(w => w.id !== id) })),

  minimizeWindow: (id) => set(s => ({
    flowWindows: s.flowWindows.map(w => w.id === id ? { ...w, minimized: !w.minimized } : w),
  })),

  focusWindow: (id) => {
    const z = get().flowNextZ;
    set(s => ({
      flowWindows: s.flowWindows.map(w => w.id === id ? { ...w, zIndex: z, minimized: false } : w),
      flowNextZ: z + 1,
    }));
  },

  moveWindow: (id, x, y) => set(s => ({
    flowWindows: s.flowWindows.map(w => w.id === id ? { ...w, position: { x, y } } : w),
  })),

  resizeWindow: (id, width, height) => set(s => ({
    flowWindows: s.flowWindows.map(win => win.id === id ? { ...win, size: { w: width, h: height } } : win),
  })),
}));
