import { create } from 'zustand';

export type ProjectListItem = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  currentRevision: number;
  updatedAt: string;
  createdAt: string;
  _count?: { items: number };
};

type ProjectsListState = {
  projects: ProjectListItem[];
  loading: boolean;
  error: string | null;
  setProjects: (projects: ProjectListItem[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  invalidate: () => void;
  reset: () => void;
};

const initialState = {
  projects: [],
  loading: false,
  error: null,
};

export const useProjectsListStore = create<ProjectsListState>((set) => ({
  ...initialState,

  setProjects: (projects) => set({ projects, error: null }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),

  invalidate: () => set({ projects: [] }),

  reset: () => set(initialState),
}));
