import { useMemo } from 'react';
import { useToast } from '@/components/ui';

/**
 * Convenience wrapper over the design-system toast context (components/ui/Toast).
 * Gives feature hooks tone-tagged one-liners without repeating the tone mapping.
 */
export function useToasts() {
  const { push } = useToast();
  return useMemo(
    () => ({
      success: (title: string, description?: string) =>
        push({ tone: 'success', title, description }),
      error: (title: string, description?: string) => push({ tone: 'danger', title, description }),
      info: (title: string, description?: string) => push({ tone: 'info', title, description }),
      warning: (title: string, description?: string) =>
        push({ tone: 'warning', title, description }),
    }),
    [push],
  );
}
