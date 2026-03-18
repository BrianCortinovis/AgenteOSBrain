import { create } from 'zustand';
import { chatApi } from '../api/chat.api';
import { useGraphStore } from './useGraphStore';
import { useProjectStore } from './useProjectStore';

interface ChatState {
  messages: any[];
  loading: boolean;
  loadHistory: (projectId: string) => Promise<void>;
  sendMessage: (projectId: string, message: string, providerId?: string, modelId?: string) => Promise<void>;
  clearHistory: (projectId: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  loading: false,

  loadHistory: async (projectId) => {
    const messages = await chatApi.getHistory(projectId);
    set({ messages });
  },

  sendMessage: async (projectId, message, providerId, modelId) => {
    set((s) => ({
      messages: [...s.messages, { id: 'temp', role: 'user', content: message, created_at: new Date().toISOString() }],
      loading: true,
    }));
    try {
      const response = await chatApi.send(projectId, message, providerId, modelId);
      set((s) => ({
        messages: [...s.messages.filter(m => m.id !== 'temp'),
          { id: 'sent', role: 'user', content: message, created_at: new Date().toISOString() },
          response,
        ],
        loading: false,
      }));
      await Promise.all([
        useGraphStore.getState().loadGraph(projectId),
        useProjectStore.getState().loadProjects(),
      ]);
    } catch (err: any) {
      set((s) => ({
        messages: [...s.messages, { id: 'err', role: 'assistant', content: `Errore: ${err.message}`, created_at: new Date().toISOString() }],
        loading: false,
      }));
    }
  },

  clearHistory: async (projectId) => {
    await chatApi.clear(projectId);
    set({ messages: [] });
  },
}));
