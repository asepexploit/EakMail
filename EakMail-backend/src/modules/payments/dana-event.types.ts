/**
 * DANA notification event types — contract between Eak-DANA APK and EakMail backend.
 * These are the only types that cross the APK↔backend boundary.
 */

/** Raw payload sent by Eak-DANA APK to POST /api/payments/dana/event */
export interface DanaNotificationEvent {
  /** SHA-256(package_name + notification_key + timestamp) — dedupe key */
  notification_id: string;
  device_id: string;
  /** ISO 8601 */
  timestamp: string;
  raw_title: string;
  raw_body: string;
  /** Rupiah amount parsed from notification, null if parsing failed */
  parsed_amount: number | null;
  parsed_description: string | null;
}

export type DanaEventStatus = 'ACCEPTED' | 'DUPLICATE' | 'NO_MATCH';

/** Response from POST /api/payments/dana/event */
export interface DanaEventResult {
  status: DanaEventStatus;
  event_id: string;
}

/** Response from GET /api/payments/dana/status */
export interface DanaDeviceStatus {
  device_id: string;
  last_event_at: string | null;
  total_events_today: number;
}

/** Stored row shape (subset of what Prisma returns) */
export interface DanaEventRow {
  id: string;
  notificationId: string;
  deviceId: string;
  rawTitle: string;
  rawBody: string;
  parsedAmount: number | null;
  parsedDescription: string | null;
  eventStatus: DanaEventStatus;
  orderId: string | null;
  createdAt: Date;
}
