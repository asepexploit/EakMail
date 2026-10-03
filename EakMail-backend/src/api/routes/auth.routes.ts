/**
 * Auth routes: login / logout / me. Thin — validate with zod, delegate to the service,
 * shape responses as shared-types DTOs. No business logic here. (backend-guide.md §2)
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AdminUserDto, LoginResponse } from '@eakmail/shared-types';
import { UnauthorizedError } from '../../lib/errors.js';
import * as authService from '../../modules/auth/auth.service.js';
import { writeAudit } from '../middleware/audit.js';
import { SESSION_COOKIE, requireAuth } from '../middleware/auth.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totp: z.string().min(1).optional(),
});

/** Options for the signed, HttpOnly session cookie. */
const cookieOptions = {
  httpOnly: true,
  sameSite: 'strict' as const,
  path: '/',
  signed: true,
  maxAge: 60 * 60 * 24 * 7, // 7 days
};

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/login', async (req, reply) => {
    const input = loginSchema.parse(req.body);

    try {
      const { session, user } = await authService.login(input);
      reply.setCookie(SESSION_COOKIE, JSON.stringify(session), cookieOptions);
      await writeAudit({ adminUserId: user.id, action: 'auth.login', target: user.id });
      const body: LoginResponse = { user };
      return body;
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        await writeAudit({ action: 'auth.login.failed', meta: { email: input.email } });
      }
      throw err;
    }
  });

  app.post('/logout', async (req, reply) => {
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return reply.status(204).send();
  });

  app.get('/me', { preHandler: requireAuth }, async (req) => {
    // requireAuth guarantees req.admin is set.
    const body: AdminUserDto = await authService.getAdminDto(req.admin!.id);
    return body;
  });
}
