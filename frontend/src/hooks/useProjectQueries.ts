import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectApi } from '@/lib/api';

export const projectKeys = {
  all: ['projects'] as const,
  list: (page?: number, limit?: number) => [...projectKeys.all, 'list', page, limit] as const,
  detail: (id: string) => [...projectKeys.all, 'detail', id] as const,
  report: (id: string) => [...projectKeys.all, 'report', id] as const,
};

export type ProjectsListResponse = {
  projects: Array<{ id: string; name: string; description?: string; status: string; currentRevision: number; updatedAt: string; createdAt: string; _count?: { items: number } }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export function useProjectsQuery(options?: { page?: number; limit?: number }) {
  const page = options?.page ?? 1;
  const limit = options?.limit ?? 20;
  return useQuery({
    queryKey: projectKeys.list(page, limit),
    queryFn: async () => {
      const { data } = await projectApi.getAll({ page, limit });
      return data;
    },
  });
}

export function useProjectQuery(projectId: string | undefined) {
  return useQuery({
    queryKey: projectKeys.detail(projectId ?? ''),
    queryFn: async () => {
      if (!projectId) throw new Error('No project ID');
      const { data } = await projectApi.getById(projectId);
      return data;
    },
    enabled: !!projectId,
  });
}

export function useReportQuery(projectId: string | undefined) {
  return useQuery({
    queryKey: projectKeys.report(projectId ?? ''),
    queryFn: async () => {
      if (!projectId) throw new Error('No project ID');
      const { data } = await projectApi.getReport(projectId);
      return data;
    },
    enabled: !!projectId,
  });
}

export function useCreateProjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; description?: string }) => {
      const { data } = await projectApi.create(payload);
      return data as { id: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all });
    },
  });
}

export function useDeleteProjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => projectApi.delete(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all });
    },
  });
}

export function useSubmitProjectMutation(projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error('No project ID');
      await projectApi.submit(projectId);
    },
    onSuccess: () => {
      if (projectId) queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
    },
  });
}

export function useFinalizeProjectMutation(projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error('No project ID');
      await projectApi.finalize(projectId);
    },
    onSuccess: () => {
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
        queryClient.invalidateQueries({ queryKey: projectKeys.report(projectId) });
      }
    },
  });
}

export function useAddItemMutation(projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (item: { partId?: string; partNumber: string; description: string; quantity: number }) => {
      if (!projectId) throw new Error('No project ID');
      const { data } = await projectApi.addItem(projectId, item);
      return data;
    },
    onSuccess: () => {
      if (projectId) queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
    },
  });
}

export function useUpdateItemMutation(projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      itemId,
      data,
    }: {
      itemId: string;
      data: { quantity?: number; panelAccessory?: string; notes?: string; partId?: string };
    }) => {
      if (!projectId) throw new Error('No project ID');
      return projectApi.updateItem(projectId, itemId, data);
    },
    onSuccess: () => {
      if (projectId) queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
    },
  });
}

export function useDeleteItemMutation(projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => {
      if (!projectId) throw new Error('No project ID');
      return projectApi.deleteItem(projectId, itemId);
    },
    onSuccess: () => {
      if (projectId) queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
    },
  });
}

export function useUploadBOMMutation(projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, replace }: { file: File; replace: boolean }) => {
      if (!projectId) throw new Error('No project ID');
      return projectApi.uploadBOM(projectId, file, replace);
    },
    onSuccess: () => {
      if (projectId) queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
    },
  });
}

export function useApplyUpgradeMutation(projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { itemId: string; wagoPartId: string }) => {
      if (!projectId) throw new Error('No project ID');
      return projectApi.applyUpgrade(projectId, payload);
    },
    onSuccess: () => {
      if (projectId) queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
    },
  });
}
