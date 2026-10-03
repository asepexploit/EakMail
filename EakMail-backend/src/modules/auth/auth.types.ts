/**
 * Local auth domain types (not part of the FE/BE wire contract).
 * Wire-facing shapes come from '@eakmail/shared-types' (AdminUserDto, LoginResponse, ...).
 */

/** Authenticated principal attached to a request after the auth guard passes. */
export interface AuthPrincipal {
  id: string;
  email: string;
  role: string;
}

/** Payload carried inside the signed session cookie. */
export interface SessionPayload {
  userId: string;
  /** Issued-at (epoch ms), for future rotation/expiry checks. */
  iat: number;
}

/** Result of verifying credentials, before a session is issued. */
export interface CredentialCheckResult {
  id: string;
  email: string;
  role: string;
  totpEnabled: boolean;
}
