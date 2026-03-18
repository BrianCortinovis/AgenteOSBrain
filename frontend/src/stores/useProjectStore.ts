import { create } from 'zustand';
import { projectsApi } from '../api/projects.api';

interface ProjectState {
  projects: any[];
  currentProjectId: string | null;
  loading: boolean;
  loadProjects: () => Promise<void>;
  setCurrentProject: (id: string | null) => void;
  createProject: (data: { name: string; description?: string }) => Promise<any>;
  updateProject: (id: string, data: any) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  duplicateProject: (id: string) => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProjectId: null,
  loading: false,

  loadProjects: async () => {
    set({ loading: true });
    try {
      const projects = await projectsApi.getAll();
      set({ projects, loading: false });
    } catch { set({ loading: false }); }
  },

  setCurrentProject: (id) => set({ currentProjectId: id }),

  createProject: async (data) => {
    const project = await projectsApi.create(data);
    await get().loadProjects();
    set({ currentProjectId: project.id });
    return project;
  },

  updateProject: async (id, data) => {
    await projectsApi.update(id, data);
    await get().loadProjects();
  },

  deleteProject: async (id) => {
    await projectsApi.delete(id);
    const { currentProjectId } = get();
    if (currentProjectId === id) set({ currentProjectId: null });
    await get().loadProjects();
  },

  duplicateProject: async (id) => {
    const project = await projectsApi.duplicate(id);
    await get().loadProjects();
    set({ currentProjectId: project.id });
  },
}));
