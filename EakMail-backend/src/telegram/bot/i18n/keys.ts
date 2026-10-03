/**
 * Storefront bot message keys — the single source of truth for every customer-facing
 * copy key (F16; PRD.md §5.9). Handlers reference these constants only; the raw string
 * literals live in the per-locale catalogs (./locales/*.ts) and may be overridden per
 * locale by `bot_config.texts`. Never hardcode customer-facing copy in handlers.
 */

export const MessageKey = {
  // Welcome / menu (/start)
  WELCOME: 'welcome',
  MENU_TITLE: 'menu.title',
  MENU_BTN_CATALOG: 'menu.button.catalog',
  MENU_BTN_STATUS: 'menu.button.status',
  MENU_BTN_LANGUAGE: 'menu.button.language',

  // Catalog (/catalog)
  CATALOG_TITLE: 'catalog.title',
  CATALOG_EMPTY: 'catalog.empty',
  CATALOG_ITEM: 'catalog.item',
  CATALOG_BUY_HINT: 'catalog.buyHint',
  CATALOG_SELECT_CATEGORY: 'catalog.selectCategory',
  CATALOG_BACK: 'catalog.back',
  CATALOG_PRODUCT_DETAIL: 'catalog.productDetail',
  CATALOG_BUY_BTN: 'catalog.buyBtn',
  CATALOG_OUT_OF_STOCK: 'catalog.outOfStock',
  CATALOG_SELECT_QTY: 'catalog.selectQty',
  CATALOG_SELECT_OPTION: 'catalog.selectOption',

  // Order flow (/order)
  ORDER_USAGE: 'order.usage',
  ORDER_PRODUCT_NOT_FOUND: 'order.productNotFound',
  ORDER_PRODUCT_INACTIVE: 'order.productInactive',
  ORDER_OUT_OF_STOCK: 'order.outOfStock',
  ORDER_CREATED: 'order.created',
  ORDER_CHOOSE_PAYMENT: 'order.choosePayment',
  ORDER_DEMO_PAID: 'order.demoPaid',
  ORDER_CHOOSE_PAYMENT_METHOD: 'order.choosePaymentMethod',
  ORDER_PAY_BALANCE_BTN: 'order.payBalanceBtn',
  ORDER_PAY_QRIS_BTN: 'order.payQrisBtn',
  ORDER_BALANCE_INSUFFICIENT: 'order.balanceInsufficient',
  ORDER_BALANCE_PAID: 'order.balancePaid',

  // Payment instructions
  PAYMENT_QR: 'payment.qr',
  PAYMENT_QR_LABEL: 'payment.qrLabel',
  PAYMENT_VA: 'payment.va',
  PAYMENT_LINK: 'payment.link',
  PAYMENT_AMOUNT: 'payment.amount',
  PAYMENT_EXPIRES: 'payment.expires',
  PAYMENT_PENDING_NOTE: 'payment.pendingNote',

  // Order status (/status)
  STATUS_USAGE: 'status.usage',
  STATUS_NOT_FOUND: 'status.notFound',
  STATUS_LINE: 'status.line',
  STATUS_PENDING: 'status.state.pending',
  STATUS_PAID: 'status.state.paid',
  STATUS_FULFILLING: 'status.state.fulfilling',
  STATUS_DELIVERED: 'status.state.delivered',
  STATUS_FAILED: 'status.state.failed',
  STATUS_REFUND_PENDING: 'status.state.refundPending',
  STATUS_REFUNDED: 'status.state.refunded',
  STATUS_EXPIRED: 'status.state.expired',

  // Fulfillment in-progress notice (sent when order enters FULFILLING)
  FULFILLING_NOTICE: 'fulfilling.notice',

  // Delivery wrapper (message sent to customer on DELIVER)
  DELIVERY_WRAPPER: 'delivery.wrapper',

  // Balance / top-up (/saldo, /topup)
  BALANCE_INFO: 'balance.info',
  BALANCE_TOPUP_BTN: 'balance.topupBtn',
  BALANCE_TOPUP_MANUAL_BTN: 'balance.topupManualBtn',
  TOPUP_AMOUNT_PROMPT: 'topup.amountPrompt',
  TOPUP_AMOUNT_INVALID: 'topup.amountInvalid',
  TOPUP_QR_CAPTION: 'topup.qrCaption',
  TOPUP_PROCESSING: 'topup.processing',
  TOPUP_CANCEL_BTN: 'topup.cancelBtn',
  TOPUP_CANCELLED: 'topup.cancelled',
  TOPUP_CANCEL_NOT_FOUND: 'topup.cancelNotFound',

  // Language (/language)
  LANGUAGE_PROMPT: 'language.prompt',
  LANGUAGE_BTN_ID: 'language.button.id',
  LANGUAGE_BTN_EN: 'language.button.en',
  LANGUAGE_SWITCHED: 'language.switched',

  // Errors
  ERROR_GENERIC: 'error.generic',
  ERROR_UNKNOWN_COMMAND: 'error.unknownCommand',
} as const;

export type MessageKey = (typeof MessageKey)[keyof typeof MessageKey];
