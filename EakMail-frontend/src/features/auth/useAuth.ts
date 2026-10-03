/**
 * Auth feature hooks — current admin session, login, logout.
 * Backed by the cookie-session endpoints (/api/auth/*). The AuthGuard and LoginPage
 * consume these; SettingsPage shows the current user.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LoginRequest } from '@eakmail/shared-types';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-client';

export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: ({ signal }) => api.auth.me(signal),
    retry: false,
    staleTime: 30_000,
  });
}

export function useLogin() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: LoginRequest) => api.auth.login(body),
    onSuccess: (result) => {
      // Seed the session cache so the guard passes immediately after login.
      client.setQueryData(queryKeys.auth.me, result.user);
    },
  });
}

export function useLogout() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api.auth.logout(),
    onSuccess: () => {
      client.setQueryData(queryKeys.auth.me, null);
      // Drop everything else so the next login starts clean.
      client.clear();
    },
  });
}
