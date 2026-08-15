import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export const useMembers = (params = {}) => {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v != null && v !== ''),
  ).toString();
  return useQuery({
    queryKey: ['members', params],
    queryFn: () => api.get(`/members${qs ? `?${qs}` : ''}`),
    placeholderData: (prev) => prev,
  });
};

const invalidate = (qc) => () => qc.invalidateQueries({ queryKey: ['members'] });

export function useInviteMember() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body) => api.post('/members', body), onSuccess: invalidate(qc) });
}

export function useChangeRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }) => api.patch(`/members/${id}`, { role }),
    onSuccess: invalidate(qc),
  });
}

export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id) => api.del(`/members/${id}`), onSuccess: invalidate(qc) });
}
