import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * Encrypts data using AES-256-GCM
 * @param data - The data to encrypt (will be JSON stringified)
 * @param key - The encryption key (must be 32 bytes for AES-256)
 * @param iv - The initialization vector (12 bytes for GCM). from crypto.randomBytes(12)
 * @returns Base64 encoded string in format: iv:authTag:encryptedData
 */
export function encryptFn(args: {data: any, key: string, iv: Buffer<ArrayBufferLike>}): string {
  // Ensure key is 32 bytes
  const keyBuffer = Buffer.from(args.key.padEnd(32, '0').slice(0, 32));

  // Create cipher
  const cipher = createCipheriv('aes-256-gcm', keyBuffer, args.iv);

  // Encrypt data
  const jsonData = JSON.stringify(args.data);
  let encrypted = cipher.update(jsonData, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  // Get auth tag
  const authTag = cipher.getAuthTag();

  // Combine iv:authTag:encrypted
  return `${args.iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypts data encrypted with the encrypt function
 * @param encryptedData - The encrypted data string (format: iv:authTag:encryptedData)
 * @param key - The encryption key (must be 32 bytes for AES-256)
 * @returns The decrypted and parsed data
 */
export function decryptFn<T = any>(args: {encryptedData: string, key: string}): T {
  // Ensure key is 32 bytes
  const keyBuffer = Buffer.from(args.key.padEnd(32, '0').slice(0, 32));

  // Split the encrypted data
  const [ivBase64, authTagBase64, encrypted] = args.encryptedData.split(':');

  if (!ivBase64 || !authTagBase64 || !encrypted) {
    throw new Error('Invalid encrypted data format');
  }

  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');

  // Create decipher
  const decipher = createDecipheriv('aes-256-gcm', keyBuffer, iv);
  decipher.setAuthTag(authTag);

  // Decrypt
  let decrypted = decipher.update(encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return JSON.parse(decrypted);
}
