import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { assignmentsApi } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

/** Roles that always have canShowContent = true (they manage content for others). */
const PRIVILEGED_ROLES = ['ADMIN', 'RSM', 'DISTRIBUTOR_REP'];

export interface ProjectBook {
  id: string;
  name: string;
  isPrimary: boolean;
  isMaster?: boolean;
}

interface AssignmentsResponse {
  catalogs: ProjectBook[];
  primaryCatalogId: string | null;
  hasAssignedProjectBooks: boolean;
}

export interface UseActiveProjectBookReturn {
  activeCatalogId: string | null;
  activeCatalogName: string | null;
  assignedProjectBooks: ProjectBook[];
  hasAssignedProjectBooks: boolean;
  /** True when this user's content-gated features (Quick Grid, Video Academy) should be visible. */
  canShowContent: boolean;
  isLoading: boolean;
  isSwitching: boolean;
  setActiveProjectBook: (catalogId: string) => Promise<void>;
}

export function useActiveProjectBook(): UseActiveProjectBookReturn {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const isGuest = !user || user.role === 'FREE';
  const isPrivileged = user?.role ? PRIVILEGED_ROLES.includes(user.role) : false;

  const { data, isLoading } = useQuery<AssignmentsResponse>({
    queryKey: ['assignments', 'me'],
    queryFn: async () => {
      const res = await assignmentsApi.getMyAssignments();
      return res.data as AssignmentsResponse;
    },
    enabled: !!user && !isGuest,
    staleTime: 5 * 60 * 1000,
  });

  const mutation = useMutation({
    mutationFn: (catalogId: string) => assignmentsApi.setPrimaryProjectBook(catalogId),
    onSuccess: (_result, catalogId) => {
      updateUser({ catalogId });
      queryClient.invalidateQueries({ queryKey: ['assignments', 'me'] });
    },
  });

  const assignedProjectBooks: ProjectBook[] = data?.catalogs ?? [];
  const hasAssignedProjectBooks = data?.hasAssignedProjectBooks ?? false;
  const primaryCatalogId = data?.primaryCatalogId ?? null;
  const activeCatalog =
    assignedProjectBooks.find((c) => c.id === primaryCatalogId) ??
    assignedProjectBooks[0] ??
    null;

  const canShowContent = isGuest
    ? false
    : isPrivileged
    ? true
    : hasAssignedProjectBooks && !!primaryCatalogId;

  return {
    activeCatalogId: activeCatalog?.id ?? null,
    activeCatalogName: activeCatalog?.name ?? null,
    assignedProjectBooks,
    hasAssignedProjectBooks,
    canShowContent,
    isLoading: !isGuest && isLoading,
    isSwitching: mutation.isPending,
    setActiveProjectBook: async (catalogId: string) => {
      await mutation.mutateAsync(catalogId);
      // Navigate to /catalog (strip ?catalogId= so active primary takes over)
      navigate('/catalog');
    },
  };
}
