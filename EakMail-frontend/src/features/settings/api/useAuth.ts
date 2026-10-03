/**
 * Re-export of the canonical auth hooks (moved to features/auth/useAuth.ts).
 * Kept so existing imports (SettingsPage) keep working without duplicating logic.
 */
export { useCurrentUser, useLogin, useLogout } from '@/features/auth/useAuth';
