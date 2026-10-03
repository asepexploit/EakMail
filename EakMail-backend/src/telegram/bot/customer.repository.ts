/**
 * Customer data access for the storefront bot (Phase 3a). Owns get-or-create of a
 * Customer by Telegram id and read/write of its language preference. No HTTP, no bot
 * logic here — see backend-guide.md §2 (route/handler → service → repository).
 */
import type { Customer } from '@prisma/client';
import type { Language } from '@eakmail/shared-types';
import { prisma } from '../../db/client.js';

/**
 * Telegram profile fields captured on every contact. All optional: an update supplies only
 * what the current Telegram context exposes, and `undefined` means "leave unchanged" so a
 * later contact never wipes a value the current update happens not to carry.
 */
export interface CustomerProfile {
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

/** Build the profile patch, treating `undefined` as "no change" (keeps prior values). */
function profilePatch(profile: CustomerProfile): {
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
} {
  const patch: { username?: string | null; firstName?: string | null; lastName?: string | null } =
    {};
  if (profile.username !== undefined) patch.username = profile.username ?? null;
  if (profile.firstName !== undefined) patch.firstName = profile.firstName ?? null;
  if (profile.lastName !== undefined) patch.lastName = profile.lastName ?? null;
  return patch;
}

/**
 * Return the Customer for a Telegram id, creating one on first contact. On every contact the
 * captured Telegram profile (username / first name / last name) is refreshed so it tracks
 * profile changes, and `lastSeenAt` is bumped so the dashboard knows when the user last
 * interacted. This is the single place customer presence is recorded — handlers never write
 * customer rows directly (backend-guide.md §2).
 */
export async function getOrCreateByTelegramId(
  telegramId: string,
  profile: CustomerProfile = {},
): Promise<Customer> {
  const patch = profilePatch(profile);
  const now = new Date();
  return prisma.customer.upsert({
    where: { telegramId },
    update: { ...patch, lastSeenAt: now },
    create: {
      telegramId,
      username: profile.username ?? null,
      firstName: profile.firstName ?? null,
      lastName: profile.lastName ?? null,
      lastSeenAt: now,
    },
  });
}

/** Persist a customer's language choice (/language switch). */
export async function setLanguage(customerId: string, language: Language): Promise<Customer> {
  return prisma.customer.update({
    where: { id: customerId },
    data: { language },
  });
}
