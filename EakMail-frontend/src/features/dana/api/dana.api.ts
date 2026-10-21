import { http } from '@/lib/http';

export interface DanaDevice {
  id: string;
  label: string;
  createdAt: string;
  revokedAt: string | null;
}

export interface DanaDeviceRegistered extends DanaDevice {
  token: string;
}

export interface DanaEvent {
  id: string;
  notificationId: string;
  deviceId: string;
  rawTitle: string;
  rawBody: string;
  parsedAmount: number | null;
  parsedDescription: string | null;
  eventStatus: 'ACCEPTED' | 'DUPLICATE' | 'NO_MATCH';
  orderId: string | null;
  createdAt: string;
}

export const danaApi = {
  listDevices: () => http.get<DanaDevice[]>('/payments/dana/devices'),
  registerDevice: (label: string) =>
    http.post<DanaDeviceRegistered>('/payments/dana/devices/register', { label }),
  revokeDevice: (deviceId: string) =>
    http.post<void>('/payments/dana/devices/revoke', { device_id: deviceId }),
  listEvents: () => http.get<DanaEvent[]>('/payments/dana/events'),
};
