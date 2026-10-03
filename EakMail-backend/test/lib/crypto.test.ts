/**
 * Tests for at-rest crypto: AES-256-GCM encrypt/decrypt round-trip (including that
 * ciphertext is non-deterministic thanks to a random IV, and that tampering is rejected
 * by the auth tag) and the maskPhone display helper.
 */
import '../workflow/_env.js';
import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, maskPhone } from '../../src/lib/crypto.js';

describe('encrypt/decrypt', () => {
  it('round-trips arbitrary UTF-8 plaintext', () => {
    const secret = 'session-string-😀-12345';
    expect(decrypt(encrypt(secret))).toBe(secret);
  });

  it('round-trips an empty string', () => {
    expect(decrypt(encrypt(''))).toBe('');
  });

  it('produces different ciphertext each call (random IV) but decrypts the same', () => {
    const a = encrypt('same');
    const b = encrypt('same');
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe('same');
    expect(decrypt(b)).toBe('same');
  });

  it('rejects tampered ciphertext via the auth tag', () => {
    const token = encrypt('protect me');
    const raw = Buffer.from(token, 'base64');
    // Flip a byte in the ciphertext region (after iv[12] + tag[16]).
    raw[raw.length - 1] ^= 0xff;
    const tampered = raw.toString('base64');
    expect(() => decrypt(tampered)).toThrow();
  });
});

describe('maskPhone', () => {
  it('keeps the first 6 and last 4 characters', () => {
    expect(maskPhone('+6281234567890')).toBe('+62812***7890');
  });
  it('fully masks short values', () => {
    expect(maskPhone('12345')).toBe('***');
    expect(maskPhone('1234567')).toBe('***');
  });
});
