import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';

const qs = (params) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '')).toString();
  return s ? `?${s}` : '';
};

export const useTransactions = (params = {}) =>
  useQuery({
    queryKey: ['transactions', params],
    queryFn: () => api.get(`/transactions${qs(params)}`),
    placeholderData: (prev) => prev,
  });

export const usePlatformTransactions = (params = {}) =>
  useQuery({
    queryKey: ['admin', 'transactions', params],
    queryFn: () => api.get(`/admin/transactions${qs(params)}`),
    placeholderData: (prev) => prev,
  });

export const useOrgTransactions = (orgId, params = {}) =>
  useQuery({
    queryKey: ['admin', 'orgs', orgId, 'transactions', params],
    queryFn: () => api.get(`/admin/orgs/${orgId}/transactions${qs(params)}`),
    enabled: !!orgId,
  });
