/**
 * Generate a QR code PNG buffer from a string.
 * Used to send QRIS payment codes as images in Telegram.
 */
import QRCode from 'qrcode';

/**
 * Returns a PNG Buffer for the given content string.
 * Width 400px gives a clear scan target on mobile screens.
 */
export async function generateQrPng(content: string): Promise<Buffer> {
  return QRCode.toBuffer(content, {
    type: 'png',
    width: 400,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
  });
}
