/**
 * Auth business logic: credential verification, optional TOTP, session payload issuance,
 * and an admin-provisioning helper. Takes/returns plain data — no Fastify objects.
 * (ARCHITECTURE.md §10, .claude/instructions/backend-guide.md §2/§10)
 */
import argon2 from 'argon2';
import { authenticator } from 'otplib';
import type { AdminUser } from '@prisma/client';
import type { AdminUserDto, LoginRequest } from '@eakmail/shared-types';
import { UnauthorizedError, ValidationError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import * as repo from './auth.repository.js';
import type { AuthPrincipal, SessionPayload } from './auth.types.js';

const log = logger.child({ module: 'auth.service' });

/** Public view of an admin user — never exposes passwordHash/totpSecret. */
export function toAdminUserDto(user: AdminUser): AdminUserDto {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    totpEnabled: Boolean(user.totpSecret),
  };
}

/**
 * Verify credentials (+TOTP when enabled) and return the session payload plus the
 * public user DTO. Throws UnauthorizedError on any mismatch — never leaks which factor failed.
 */
export async function login(input: LoginRequest): Promise<{
  session: SessionPayload;
  user: AdminUserDto;
}> {
  const user = await repo.findByEmail(input.email);
  if (!user) {
    // Verify against a dummy hash to keep timing uniform for unknown emails.
    await argon2.verify(DUMMY_HASH, input.password).catch(() => false);
    throw new UnauthorizedError('Invalid credentials');
  }

  const passwordOk = await argon2.verify(user.passwordHash, input.password).catch(() => false);
  if (!passwordOk) throw new UnauthorizedError('Invalid credentials');

  if (user.totpSecret) {
    if (!input.totp) throw new UnauthorizedError('TOTP required');
    const totpOk = authenticator.verify({ token: input.totp, secret: user.totpSecret });
    if (!totpOk) throw new UnauthorizedError('Invalid credentials');
  }

  log.info({ userId: user.id }, 'admin login');
  return {
    session: { userId: user.id, iat: Date.now() },
    user: toAdminUserDto(user),
  };
}

/** Resolve the principal for a session payload; throws if the user no longer exists. */
export async function resolvePrincipal(session: SessionPayload): Promise<AuthPrincipal> {
  const user = await repo.findById(session.userId);
  if (!user) throw new UnauthorizedError('Session no longer valid');
  return { id: user.id, email: user.email, role: user.role };
}

/** Public DTO for the currently authenticated admin (GET /me). */
export async function getAdminDto(userId: string): Promise<AdminUserDto> {
  const user = await repo.findById(userId);
  if (!user) throw new UnauthorizedError('Session no longer valid');
  return toAdminUserDto(user);
}

/**
 * Provision an admin (used by the seed/CLI, not exposed over HTTP).
 * Hashes with argon2id; optionally attaches a TOTP secret.
 */
export async function createAdmin(
  email: string,
  password: string,
  opts: { totpSecret?: string; role?: string } = {},
): Promise<AdminUserDto> {
  if (!email.includes('@')) throw new ValidationError('A valid email is required');
  if (password.length < 8) throw new ValidationError('Password must be at least 8 characters');

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const user = await repo.createAdminUser({
    email,
    passwordHash,
    totpSecret: opts.totpSecret,
    role: opts.role,
  });
  log.info({ userId: user.id }, 'admin created');
  return toAdminUserDto(user);
}

/**
 * Precomputed argon2id hash of a random throwaway string, used only to equalize timing
 * on the unknown-email path so login does not leak which emails exist.
 */
const DUMMY_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHRzb21lc2FsdA$RdescudvJCsgt3ub+b+dWRWJTmaaJObG';
