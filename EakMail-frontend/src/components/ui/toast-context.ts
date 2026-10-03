import { createContext } from 'react';
import type { StatusTone } from '@/lib/status-tokens';

export interface ToastOptions {
  title: string;
  description?: string;
  /** Tone drives the accent color (success/danger/warning/info/neutral). */
  tone?: StatusTone;
  /** Auto-dismiss delay in ms; 0 keeps it until dismissed. */
  durationMs?: number;
}

export interface ToastEntry extends ToastOptions {
  id: string;
}

export interface ToastContextValue {
  toasts: ToastEntry[];
  push: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
}

/** Shared context for the toast system (provider in Toast.tsx, hook in useToast.ts). */
export const ToastContext = createContext<ToastContextValue | null>(null);
