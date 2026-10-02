/**
 * encryption.js — AES-256-GCM symmetric encryption for sensitive strings.
 *
 * Usage:
 *   const { encrypt, decrypt } = await import('./lib/encryption.js');
 *   const ciphertext = encrypt('my-secret-token');
 *   const plaintext  = decrypt(ciphertext);
 *
 * Requires env var: ENCRYPTION_KEY — 64 hex chars (32 raw bytes).
 * Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * Stored format (colon-separated): "<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES   = 12; // 96-bit IV — recommended for GCM

function getKey() {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      'ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Encrypts a UTF-8 plaintext string.
 * @param {string} plaintext
 * @returns {string} "<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 */
export function encrypt(plaintext) {
  const key = getKey();
  const iv  = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts a ciphertext produced by encrypt().
 * @param {string} ciphertext "<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 * @returns {string} plaintext
 */
export function decrypt(ciphertext) {
  const key = getKey();
  const [ivHex, authTagHex, dataHex] = ciphertext.split(':');
  if (!ivHex || !authTagHex || !dataHex) {
    throw new Error('Invalid ciphertext format — expected "<iv>:<authTag>:<data>"');
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}
