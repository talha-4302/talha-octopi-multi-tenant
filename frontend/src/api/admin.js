import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export const useStats = () => useQuery({ queryKey: ['admin', 'stats'], queryFn: () => api.get('/admin/stats') });

export const useOrgs = (params = {}) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '')).toString();
  return useQuery({
    queryKey: ['admin', 'orgs', params],
    queryFn: () => api.get(`/admin/orgs${s ? `?${s}` : ''}`),
    placeholderData: (prev) => prev,
  });
};

export const useOrgDetail = (orgId) =>
  useQuery({
    queryKey: ['admin', 'orgs', orgId],
    queryFn: () => api.get(`/admin/orgs/${orgId}`),
    enabled: !!orgId,
  });

const refreshOrgs = (qc) => () => qc.invalidateQueries({ queryKey: ['admin', 'orgs'] });

export function useSuspendOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orgId, reason }) => api.post(`/admin/orgs/${orgId}/suspend`, { reason }),
    onSuccess: refreshOrgs(qc),
  });
}

export function useReactivateOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orgId) => api.post(`/admin/orgs/${orgId}/reactivate`),
    onSuccess: refreshOrgs(qc),
  });
}
