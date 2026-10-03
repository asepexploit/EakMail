import { clsx, type ClassValue } from 'clsx';

/**
 * Class-name helper: merges conditional Tailwind class values into one string.
 * Thin wrapper around clsx so components have a single, consistent entry point.
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
