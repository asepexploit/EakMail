/** Structured logger (Pino). Import `logger` everywhere; create children per module. */
import pino from 'pino';
import { config } from '../config/index.js';

export const logger = pino({
  level: config.NODE_ENV === 'test' ? 'silent' : 'info',
  transport:
    config.NODE_ENV === 'development'
      ? { target: 'pino/file', options: { destination: 1 } }
      : undefined,
});

export type Logger = typeof logger;
