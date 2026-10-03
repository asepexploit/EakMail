import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, maskPhone } from './crypto.js';

describe('encrypt / decrypt (AES-256-GCM)', () => {
  it('round-trips a plain string', () => {
    const plain = 'super secret telegram session string';
    expect(decrypt(encrypt(plain))).toBe(plain);
  });

  it('round-trips an empty string', () => {
    expect(decrypt(encrypt(''))).toBe('');
  });

  it('round-trips a unicode string', () => {
    const plain = '🔑 sesión Ünïcödé 日本語';
    expect(decrypt(encrypt(plain))).toBe(plain);
  });

  it('produces different ciphertext each call (random IV)', () => {
    const plain = 'same input';
    expect(encrypt(plain)).not.toBe(encrypt(plain));
  });

  it('ciphertext is valid base64', () => {
    const ct = encrypt('hello');
    expect(() => Buffer.from(ct, 'base64')).not.toThrow();
  });

  it('throws on tampered ciphertext', () => {
    const ct = Buffer.from(encrypt('sensitive data'), 'base64');
    // flip a byte in the ciphertext region (after iv[12] + tag[16])
    ct[ct.length - 1] = (ct[ct.length - 1]! ^ 0xff);
    expect(() => decrypt(ct.toString('base64'))).toThrow();
  });

  it('throws on truncated ciphertext', () => {
    expect(() => decrypt(Buffer.from('tooshort').toString('base64'))).toThrow();
  });
});

describe('maskPhone', () => {
  it('masks a standard phone number', () => {
    expect(maskPhone('+6281234567890')).toBe('+62812***7890');
  });

  it('masks a 7-character or shorter string with ***', () => {
    expect(maskPhone('123456')).toBe('***');
    expect(maskPhone('1234567')).toBe('***');
  });

  it('masks an 8-character string', () => {
    const result = maskPhone('12345678');
    expect(result).toBe('123456***5678');
  });
});
