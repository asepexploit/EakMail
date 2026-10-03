/**
 * Session-cookie auth guard. Reads the signed session cookie, verifies its signature,
 * resolves the admin principal, and attaches it to the request. Throws UnauthorizedError
 * on any failure. Use as a Fastify `preHandler` on protected routes.
 * (ARCHITECTURE.md §10, backend-guide.md §10)
 */
import type { FastifyReply, FastifyRequest } from 'fastify';
import { UnauthorizedError } from '../../lib/errors.js';
import * as authService from '../../modules/auth/auth.service.js';
import type { AuthPrincipal, SessionPayload } from '../../modules/auth/auth.types.js';

/** Name of the HttpOnly signed session cookie. */
export const SESSION_COOKIE = 'eak_session';

declare module 'fastify' {
  interface FastifyRequest {
    /** Populated by `requireAuth`; present only on guarded routes. */
    admin?: AuthPrincipal;
  }
}

function parseSession(raw: string): SessionPayload {
  const parsed = JSON.parse(raw) as Partial<SessionPayload>;
  if (typeof parsed.userId !== 'string' || typeof parsed.iat !== 'number') {
    throw new UnauthorizedError('Malformed session');
  }
  return { userId: parsed.userId, iat: parsed.iat };
}

export async function requireAuth(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const cookie = req.cookies[SESSION_COOKIE];
  if (!cookie) throw new UnauthorizedError('Not authenticated');

  const unsigned = req.unsignCookie(cookie);
  if (!unsigned.valid || unsigned.value == null) {
    throw new UnauthorizedError('Invalid session signature');
  }

  let session: SessionPayload;
  try {
    session = parseSession(unsigned.value);
  } catch {
    throw new UnauthorizedError('Malformed session');
  }

  req.admin = await authService.resolvePrincipal(session);
}
