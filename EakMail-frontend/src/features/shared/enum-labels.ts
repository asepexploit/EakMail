/**
 * Bahasa Indonesia labels for domain enums (DESIGN_SYSTEM.md §14). Centralized here so
 * status/method/state words stay consistent across every feature and are never hardcoded
 * inline in components. Code identifiers stay English; only the display label is localized.
 */
import {
  AccountStatus,
  BroadcastStatus,
  ExecutionCommand,
  ExecutionMode,
  ExecutionState,
  Language,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  StepStatus,
  type AccountStatus as AccountStatusType,
  type BroadcastStatus as BroadcastStatusType,
  type ExecutionCommand as ExecutionCommandType,
  type ExecutionMode as ExecutionModeType,
  type ExecutionState as ExecutionStateType,
  type Language as LanguageType,
  type OrderStatus as OrderStatusType,
  type PaymentMethod as PaymentMethodType,
  type PaymentStatus as PaymentStatusType,
  type StepStatus as StepStatusType,
} from '@eakmail/shared-types';

export const orderStatusLabel: Record<OrderStatusType, string> = {
  [OrderStatus.PENDING]: 'Menunggu',
  [OrderStatus.PAID]: 'Dibayar',
  [OrderStatus.FULFILLING]: 'Diproses',
  [OrderStatus.DELIVERED]: 'Terkirim',
  [OrderStatus.FAILED]: 'Gagal',
  [OrderStatus.REFUND_PENDING]: 'Refund Diproses',
  [OrderStatus.REFUNDED]: 'Dikembalikan',
  [OrderStatus.EXPIRED]: 'Kedaluwarsa',
};

export const paymentStatusLabel: Record<PaymentStatusType, string> = {
  [PaymentStatus.PENDING]: 'Menunggu',
  [PaymentStatus.PAID]: 'Dibayar',
  [PaymentStatus.EXPIRED]: 'Kedaluwarsa',
  [PaymentStatus.FAILED]: 'Gagal',
  [PaymentStatus.REFUNDED]: 'Dikembalikan',
};

export const paymentMethodLabel: Record<PaymentMethodType, string> = {
  [PaymentMethod.QRIS]: 'QRIS',
  [PaymentMethod.BRI_VA]: 'VA BRI',
  [PaymentMethod.BNI_VA]: 'VA BNI',
  [PaymentMethod.CIMB_NIAGA_VA]: 'VA CIMB Niaga',
  [PaymentMethod.PERMATA_VA]: 'VA Permata',
  [PaymentMethod.MAYBANK_VA]: 'VA Maybank',
  [PaymentMethod.BNC_VA]: 'VA BNC',
  [PaymentMethod.ARTHA_GRAHA_VA]: 'VA Artha Graha',
  [PaymentMethod.SAMPOERNA_VA]: 'VA Sampoerna',
  [PaymentMethod.PAYMENT_LINK]: 'Payment Link',
};

export const executionStateLabel: Record<ExecutionStateType, string> = {
  [ExecutionState.PENDING]: 'Menunggu',
  [ExecutionState.RUNNING]: 'Berjalan',
  [ExecutionState.PAUSED]: 'Dijeda',
  [ExecutionState.SUCCEEDED]: 'Berhasil',
  [ExecutionState.FAILED]: 'Gagal',
  [ExecutionState.TIMED_OUT]: 'Timeout',
  [ExecutionState.CANCELLED]: 'Dibatalkan',
};

export const stepStatusLabel: Record<StepStatusType, string> = {
  [StepStatus.PENDING]: 'Menunggu',
  [StepStatus.RUNNING]: 'Berjalan',
  [StepStatus.SUCCEEDED]: 'Berhasil',
  [StepStatus.FAILED]: 'Gagal',
  [StepStatus.TIMED_OUT]: 'Timeout',
  [StepStatus.SKIPPED]: 'Dilewati',
};

export const accountStatusLabel: Record<AccountStatusType, string> = {
  [AccountStatus.CONNECTED]: 'Terhubung',
  [AccountStatus.FLOOD_WAIT]: 'Flood Wait',
  [AccountStatus.BANNED]: 'Diblokir',
  [AccountStatus.LOGGED_OUT]: 'Keluar',
  [AccountStatus.DISCONNECTED]: 'Terputus',
};

export const executionModeLabel: Record<ExecutionModeType, string> = {
  [ExecutionMode.PRODUCTION]: 'Produksi',
  [ExecutionMode.TEST]: 'Uji',
};

export const executionCommandLabel: Record<ExecutionCommandType, string> = {
  [ExecutionCommand.PAUSE]: 'Jeda',
  [ExecutionCommand.RESUME]: 'Lanjutkan',
  [ExecutionCommand.CANCEL]: 'Batalkan',
  [ExecutionCommand.RETRY_FROM_START]: 'Ulang dari Awal',
  [ExecutionCommand.RETRY_FROM_FAILED]: 'Ulang dari Node Gagal',
  [ExecutionCommand.STEP]: 'Langkah',
};

export const broadcastStatusLabel: Record<BroadcastStatusType, string> = {
  [BroadcastStatus.DRAFT]: 'Draf',
  [BroadcastStatus.SENDING]: 'Mengirim',
  [BroadcastStatus.COMPLETED]: 'Selesai',
  [BroadcastStatus.FAILED]: 'Gagal',
};

export const languageLabel: Record<LanguageType, string> = {
  [Language.ID]: 'Indonesia',
  [Language.EN]: 'English',
};
