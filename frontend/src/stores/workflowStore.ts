import { create } from 'zustand';

/** Minimal BOM representation for workflow state */
export interface BomData {
  projectId?: string;
  itemCount: number;
  name?: string;
  createdAt?: string;
}

interface WorkflowState {
  /** True when user has created/uploaded a BOM (enables Row 2 & 3) */
  hasBom: boolean;
  /** Current project created from BOM (enables "from Project" actions in Row 2) */
  activeProjectId: string | null;
  /** BOM source data (e.g. from upload or build) */
  bomData: BomData | null;
  setHasBom: (value: boolean) => void;
  setActiveProjectId: (id: string | null) => void;
  setBomData: (data: BomData | null) => void;
  /** Call after successful BOM upload/build */
  setBomReady: (data: BomData) => void;
  /** Call after creating a project from BOM */
  setProjectFromBom: (projectId: string) => void;
  resetWorkflow: () => void;
}

const initialState = {
  hasBom: false,
  activeProjectId: null,
  bomData: null,
};

export const useWorkflowStore = create<WorkflowState>((set) => ({
  ...initialState,

  setHasBom: (value) => set({ hasBom: value }),

  setActiveProjectId: (id) => set({ activeProjectId: id }),

  setBomData: (data) => set({ bomData: data }),

  setBomReady: (data) =>
    set({
      hasBom: true,
      bomData: data,
    }),

  setProjectFromBom: (projectId) =>
    set({
      activeProjectId: projectId,
    }),

  resetWorkflow: () => set(initialState),
}));
