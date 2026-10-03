/**
 * English catalog (PRD.md §5.9). Complete: every MessageKey has a value, so a customer
 * on 'en' never falls back to Indonesian unless a specific key is missing here.
 * `bot_config.texts.en` overrides individual keys at runtime.
 */
import { MessageKey } from '../keys.js';
import type { Catalog } from '../types.js';

const en: Catalog = {
  // Welcome / menu
  [MessageKey.WELCOME]:
    'Welcome to {{brandName}}! 👋\n\nWe offer digital products with automatic delivery. Use the menu below to get started.',
  [MessageKey.MENU_TITLE]: 'Please choose an option:',
  [MessageKey.MENU_BTN_CATALOG]: '🛍️ Catalog',
  [MessageKey.MENU_BTN_STATUS]: '📦 Order Status',
  [MessageKey.MENU_BTN_LANGUAGE]: '🌐 Language',

  // Catalog
  [MessageKey.CATALOG_TITLE]: '🛍️ {{brandName}} Product Catalog',
  [MessageKey.CATALOG_EMPTY]: 'No products are available right now. Please check back later.',
  [MessageKey.CATALOG_ITEM]: '• {{name}} — Rp{{price}}\n  Buy: /order {{id}}',
  [MessageKey.CATALOG_BUY_HINT]:
    'To order, type /order <product_id> using the list above.',
  [MessageKey.CATALOG_SELECT_CATEGORY]: '📦 SELECT PRODUCT\n\nChoose a category below.',
  [MessageKey.CATALOG_BACK]: '⬅️ Back',
  [MessageKey.CATALOG_PRODUCT_DETAIL]:
    '📦 Product: {{name}}\n💵 Price: Rp{{price}}\n\n{{description}}',
  [MessageKey.CATALOG_BUY_BTN]: '🛒 Buy {{name}}',
  [MessageKey.CATALOG_OUT_OF_STOCK]: '❌ Out of stock',
  [MessageKey.CATALOG_SELECT_QTY]: '📦 {{name}}\n💵 Price: Rp{{price}}/pcs\n\nSelect quantity:',
  [MessageKey.CATALOG_SELECT_OPTION]: 'Choose a product option below:',

  // Order flow
  [MessageKey.ORDER_USAGE]: 'How to order: type /order <product_id>.\nSee available products with /catalog.',
  [MessageKey.ORDER_PRODUCT_NOT_FOUND]: 'Product not found. See the list with /catalog.',
  [MessageKey.ORDER_PRODUCT_INACTIVE]: 'Sorry, this product is currently unavailable.',
  [MessageKey.ORDER_OUT_OF_STOCK]: 'Sorry, this product is currently out of stock.',
  [MessageKey.ORDER_CREATED]:
    '✅ Order created!\n\nProduct: {{productName}}\nAmount: Rp{{amount}}\nOrder ID: {{orderId}}',
  [MessageKey.ORDER_CHOOSE_PAYMENT]: 'Please complete the payment below:',
  [MessageKey.ORDER_DEMO_PAID]: '🧪 Demo mode — payment skipped.\nOrder is being processed!',
  [MessageKey.ORDER_CHOOSE_PAYMENT_METHOD]:
    '🛒 *{{productName}}{{qty}}*\n\n💰 Total: *Rp{{amount}}*\nYour balance: Rp{{balance}}\n\nChoose payment method:',
  [MessageKey.ORDER_PAY_BALANCE_BTN]: '💰 Pay with Balance (Rp{{balance}})',
  [MessageKey.ORDER_PAY_QRIS_BTN]: '📱 Pay via QRIS / VA',
  [MessageKey.ORDER_BALANCE_INSUFFICIENT]:
    '❌ Insufficient balance.\n\nYour balance: Rp{{balance}}\nRequired: Rp{{amount}}\n\nUse the button below to top up via QRIS/VA, or contact admin.',
  [MessageKey.ORDER_BALANCE_PAID]:
    '✅ Balance payment successful!\n\nProduct: {{productName}}\nTotal: Rp{{amount}}\nRemaining balance: Rp{{newBalance}}',

  // Payment instructions
  [MessageKey.PAYMENT_QR]:
    '💳 QRIS Payment\nScan the QR code below with your e-wallet or mobile banking app:\n\n{{qrString}}',
  [MessageKey.PAYMENT_QR_LABEL]:
    '💳 *QRIS Payment*\nScan the QR image above with your e-wallet or mobile banking app.',
  [MessageKey.PAYMENT_VA]:
    '💳 Virtual Account\nTransfer to the following VA number:\n\n{{vaNumber}}',
  [MessageKey.PAYMENT_LINK]:
    '💳 Payment Link\nContinue your payment via the following link:\n\n{{paymentUrl}}',
  [MessageKey.PAYMENT_AMOUNT]: 'Total to pay: Rp{{amount}}',
  [MessageKey.PAYMENT_EXPIRES]: '⏳ Pay before: {{expiresAt}}',
  [MessageKey.PAYMENT_PENDING_NOTE]:
    'Once your payment succeeds, the product is delivered automatically. Check status with /status {{orderId}}.',

  // Order status
  [MessageKey.STATUS_USAGE]: 'How to check status: type /status <order_id>.',
  [MessageKey.STATUS_NOT_FOUND]: 'Order not found. Please check the order ID.',
  [MessageKey.STATUS_LINE]: 'Status of order {{orderId}}: {{statusLabel}}',
  [MessageKey.STATUS_PENDING]: 'Awaiting payment ⏳',
  [MessageKey.STATUS_PAID]: 'Paid ✅',
  [MessageKey.STATUS_FULFILLING]: 'Processing ⚙️',
  [MessageKey.STATUS_DELIVERED]: 'Delivered 🎉',
  [MessageKey.STATUS_FAILED]: 'Failed ❌',
  [MessageKey.STATUS_REFUND_PENDING]: 'Refund pending 💸',
  [MessageKey.STATUS_REFUNDED]: 'Refunded ↩️',
  [MessageKey.STATUS_EXPIRED]: 'Expired ⌛',

  // Fulfillment notice
  [MessageKey.FULFILLING_NOTICE]:
    '🔄 Processing — *{{productName}}*\n🆔 `{{orderId}}`',

  // Delivery wrapper
  [MessageKey.DELIVERY_WRAPPER]:
    '🎉 *Order Delivered!*\n\nHey! Your digital product is ready 🚀\n\n📦 *Your product:*\n\n{{payload}}\n\n──────────────────────\n🆔 Order ID: `{{orderId}}`\nKeep this message as proof!\n──────────────────────\n\nThank you for shopping! ❤️',

  // Payment outcome notifications
  [MessageKey.TOPUP_SUCCESS]:
    '✅ *Top Up Successful!*\n\nYour balance has been credited 🎉\n\n💰 Amount: *Rp {{amount}}*\n💳 Method: QRIS\n\n──────────────────────\n💼 Your balance now: *Rp {{newBalance}}*\n──────────────────────\n\nReady to shop? Type /catalog to browse products 🛍️',

  [MessageKey.PAYMENT_CONFIRMED]:
    '✅ *Payment Received!*\n\nYour payment has been confirmed 🎉\nWe\'re processing your order...\n\n📦 Product: *{{productName}}*\n💰 Total: *Rp {{amount}}*\n🆔 Order ID: `{{orderId}}`\n\n──────────────────────\n_You\'ll receive another notification when your product is ready to deliver_ 📬\n──────────────────────',

  [MessageKey.PAYMENT_EXPIRED]:
    '⏰ *Payment Expired*\n\nThe payment window for your order has expired 😔\n\n📦 Product: *{{productName}}*\n💰 Total: *Rp {{amount}}*\n🆔 Order ID: `{{orderId}}`\n\n──────────────────────\nDon\'t worry, no charges have been applied.\n\nWant to try again? Type /catalog 🛍️\n──────────────────────',

  // Balance / top-up
  [MessageKey.BALANCE_INFO]:
    '💰 *Your Balance*\n\n`Rp {{balance}}`\n\nPick a top-up amount below, or tap "Other Amount" to enter manually.',
  [MessageKey.BALANCE_TOPUP_BTN]: '➕ Top Up',
  [MessageKey.BALANCE_TOPUP_MANUAL_BTN]: '✏️ Other Amount',
  [MessageKey.TOPUP_AMOUNT_PROMPT]:
    '✏️ Enter your top-up amount (minimum Rp5,000):\n\nExample: `25000`',
  [MessageKey.TOPUP_AMOUNT_INVALID]:
    '❌ Invalid amount. Minimum is Rp5,000, e.g.: `25000`',
  [MessageKey.TOPUP_QR_CAPTION]:
    '💳 *Top Up Rp{{amount}}*\n\nScan the QR above with your e-wallet or mobile banking app.\nPay exactly *Rp{{amount}}* — balance is credited automatically after payment.\n\n⏳ Pay before: {{expiresAt}}',
  [MessageKey.TOPUP_PROCESSING]: '⏳ Creating QRIS...',
  [MessageKey.TOPUP_CANCEL_BTN]: '❌ Cancel',
  [MessageKey.TOPUP_CANCELLED]: '✅ Top-up cancelled.',
  [MessageKey.TOPUP_CANCEL_NOT_FOUND]: 'Top-up not found or already completed.',

  // Language
  [MessageKey.LANGUAGE_PROMPT]: 'Choose your language / Pilih bahasa:',
  [MessageKey.LANGUAGE_BTN_ID]: '🇮🇩 Bahasa Indonesia',
  [MessageKey.LANGUAGE_BTN_EN]: '🇬🇧 English',
  [MessageKey.LANGUAGE_SWITCHED]: 'Language switched to English. ✅',

  // Help (/help)
  [MessageKey.HELP_TEXT]:
    '💬 *HELP & SUPPORT*\n\nIf you have any issues with payment, balance, orders, products, or refunds, please contact our CS via the button below. Include your transaction Ref ID so we can find your order faster.\n\n🕒 *Support hours:* 09:00–21:00 WIB\n❓ *FAQ:* Include your transaction Ref ID when contacting CS.\n\n💬 When contacting CS, include the Ref ID, product name, time of issue, and a brief description. Never send OTPs or personal passwords.\n\nStore: *{{brandName}}*',
  [MessageKey.HELP_CS_BTN]: '💬 Contact Support',
  [MessageKey.HELP_BACK_BTN]: '⬅️ Back',

  // Errors
  [MessageKey.ERROR_GENERIC]: 'Something went wrong. Please try again later.',
  [MessageKey.ERROR_UNKNOWN_COMMAND]:
    'Unknown command. Type /start to see the menu.',
};

export default en;
