/**
 * Central Fastify error handler: maps domain and validation errors to a stable
 * JSON envelope { error: { code, message } }. (PRD.md §9, backend-guide.md §8)
 */
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';

const log = logger.child({ module: 'error-handler' });

interface ErrorBody {
  error: { code: string; message: string };
}

function envelope(code: string, message: string): ErrorBody {
  return { error: { code, message } };
}

const RPC_MESSAGES: Record<string, string> = {
  PASSWORD_HASH_INVALID: 'Password 2FA salah. Coba lagi.',
  PHONE_CODE_INVALID: 'Kode OTP salah atau sudah kadaluarsa.',
  PHONE_CODE_EXPIRED: 'Kode OTP kadaluarsa. Mulai ulang login.',
  FLOOD_WAIT: 'Terlalu banyak percobaan. Tunggu sebentar.',
  SESSION_PASSWORD_NEEDED: 'Akun ini menggunakan 2FA. Masukkan password.',
  AUTH_KEY_UNREGISTERED: 'Sesi tidak valid. Login ulang.',
};

function rpcErrorMessage(errorMessage: string): string {
  for (const [key, label] of Object.entries(RPC_MESSAGES)) {
    if (errorMessage.includes(key)) return label;
  }
  return `Telegram error: ${errorMessage}`;
}

export function errorHandler(
  err: FastifyError | Error,
  _req: FastifyRequest,
  reply: FastifyReply,
): void {
  if (err instanceof AppError) {
    log.warn({ code: err.code, msg: err.message }, 'app error');
    reply.status(err.httpStatus).send(envelope(err.code, err.message));
    return;
  }

  if (err instanceof ZodError) {
    const message = err.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ');
    log.warn({ message }, 'zod validation error');
    reply.status(400).send(envelope('VALIDATION', message));
    return;
  }

  // Fastify's own validation (fastANeeds) surfaces as a FastifyError with statusCode 400.
  const fastifyErr = err as FastifyError;
  if (fastifyErr.statusCode && fastifyErr.statusCode >= 400 && fastifyErr.statusCode < 500) {
    reply
      .status(fastifyErr.statusCode)
      .send(envelope(fastifyErr.code ?? 'BAD_REQUEST', fastifyErr.message));
    return;
  }

  // GramJS RPCError — surface Telegram's error message as 400 so it reaches the client.
  const rpcErr = err as { errorMessage?: string; code?: number };
  if (typeof rpcErr.errorMessage === 'string' && typeof rpcErr.code === 'number' && rpcErr.code >= 400 && rpcErr.code < 500) {
    const friendly = rpcErrorMessage(rpcErr.errorMessage);
    log.warn({ errorMessage: rpcErr.errorMessage }, 'telegram rpc error');
    reply.status(400).send(envelope('TELEGRAM_RPC', friendly));
    return;
  }

  log.error({ err }, 'unhandled error');
  reply.status(500).send(envelope('INTERNAL', 'Internal server error'));
}
