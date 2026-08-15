import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export const useOrg = () => useQuery({ queryKey: ['org'], queryFn: () => api.get('/org') });

export function useUpdateOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.patch('/org', body),
    onSuccess: (data) => qc.setQueryData(['org'], (old) => ({ ...old, ...data })),
  });
}
