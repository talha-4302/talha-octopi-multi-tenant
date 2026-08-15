import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export const useSubscription = (options = {}) =>
  useQuery({ queryKey: ['subscription'], queryFn: () => api.get('/subscription'), ...options });

const refresh = (qc) => () => {
  qc.invalidateQueries({ queryKey: ['subscription'] });
  qc.invalidateQueries({ queryKey: ['org'] });
};

export function useCreateCheckout() {
  return useMutation({ mutationFn: (body = {}) => api.post('/subscription/checkout', body) });
}

export function useChangePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (planId) => api.post('/subscription/change', { planId }),
    onSuccess: refresh(qc),
  });
}

export function useCancelSubscription() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => api.post('/subscription/cancel'), onSuccess: refresh(qc) });
}

export function useBillingPortal() {
  return useMutation({ mutationFn: () => api.post('/billing/portal') });
}
