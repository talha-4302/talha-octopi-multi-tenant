import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export const useForgotPassword = () =>
  useMutation({ mutationFn: (email) => api.post('/auth/forgot-password', { email }) });

export const useResetPassword = () =>
  useMutation({ mutationFn: (body) => api.post('/auth/reset-password', body) });

export const useAcceptInvite = () =>
  useMutation({ mutationFn: (body) => api.post('/auth/accept-invite', body) });

export const useMe = () => useMutation({ mutationFn: (body) => api.patch('/me', body) });

export const useChangePassword = () =>
  useMutation({ mutationFn: (body) => api.post('/me/password', body) });
