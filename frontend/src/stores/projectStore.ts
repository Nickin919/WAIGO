import { create } from 'zustand';

export type ProjectItemPart = {
  id: string;
  partNumber: string;
  description: string;
  thumbnailUrl?: string | null;
};

export type ProjectItem = {
  id: string;
  projectId: string;
  revisionNumber: number;
  partId: string | null;
  manufacturer: string | null;
  partNumber: string;
  description: string;
  quantity: number;
  unitPrice: number | null;
  isWagoPart: boolean;
  hasWagoEquivalent: boolean;
  panelAccessory: 'PANEL' | 'ACCESSORY' | null;
  notes: string | null;
  createdAt: string;
  part?: ProjectItemPart | null;
};

export type Project = {
  id: string;
  name: string;
  description: string | null;
  status: 'DRAFT' | 'SUBMITTED' | 'PROCESSING' | 'COMPLETED';
  currentRevision: number;
  userId: string;
  createdAt: string;
  updatedAt: string;
  items?: ProjectItem[];
};

type ProjectState = {
  project: Project | null;
  items: ProjectItem[];
  loading: boolean;
  error: string | null;
  setProject: (project: Project | null) => void;
  setItems: (items: ProjectItem[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  updateItem: (itemId: string, patch: Partial<Pick<ProjectItem, 'quantity' | 'panelAccessory' | 'notes'>>) => void;
  addItem: (item: ProjectItem) => void;
  removeItem: (itemId: string) => void;
  setStatus: (status: Project['status']) => void;
  reset: () => void;
};

const initialState = {
  project: null,
  items: [],
  loading: false,
  error: null,
};

export const useProjectStore = create<ProjectState>((set) => ({
  ...initialState,

  setProject: (project) =>
    set({
      project,
      items: project?.items ?? [],
      error: null,
    }),

  setItems: (items) => set({ items }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),

  updateItem: (itemId, patch) =>
    set((state) => ({
      items: state.items.map((i) =>
        i.id === itemId ? { ...i, ...patch } : i
      ),
    })),

  addItem: (item) =>
    set((state) => ({
      items: [...state.items, item],
    })),

  removeItem: (itemId) =>
    set((state) => ({
      items: state.items.filter((i) => i.id !== itemId),
    })),

  setStatus: (status) =>
    set((state) =>
      state.project ? { project: { ...state.project, status } } : state
    ),

  reset: () => set(initialState),
}));
