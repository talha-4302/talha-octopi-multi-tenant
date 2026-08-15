import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export const usePlans = () => useQuery({ queryKey: ['plans'], queryFn: () => api.get('/plans') });

export const useAllPlans = () =>
  useQuery({ queryKey: ['plans', 'all'], queryFn: () => api.get('/admin/plans') });

export function useCreatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.post('/admin/plans', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans'] }),
  });
}

export function useUpdatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => api.patch(`/admin/plans/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans'] }),
  });
}
