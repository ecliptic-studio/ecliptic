/**
 * Browser-compatible encryption using Web Crypto API
 * Encrypts data using AES-256-GCM
 * @param data - The data to encrypt (will be JSON stringified)
 * @param key - The encryption key (must be 32 bytes for AES-256)
 * @param iv - The initialization vector (12 bytes for GCM)
 * @returns Base64 encoded string in format: iv:authTag:encryptedData
 */
export async function encryptFnBrowser(args: {
  data: any;
  key: string;
  iv: Uint8Array;
}): Promise<string> {
  // Ensure key is 32 bytes
  const keyString = args.key.padEnd(32, '0').slice(0, 32);
  const keyBuffer = new TextEncoder().encode(keyString);

  // Import the key
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  // Encrypt data
  const jsonData = JSON.stringify(args.data);
  const dataBuffer = new TextEncoder().encode(jsonData);

  // Encrypt (AES-GCM automatically generates and appends the auth tag)
  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: args.iv,
      tagLength: 128, // 16 bytes auth tag
    },
    cryptoKey,
    dataBuffer
  );

  // The encrypted buffer contains both the ciphertext and the auth tag (last 16 bytes)
  const encryptedArray = new Uint8Array(encryptedBuffer);

  // Split into ciphertext and auth tag
  const ciphertext = encryptedArray.slice(0, -16);
  const authTag = encryptedArray.slice(-16);

  // Convert to base64
  const ivBase64 = btoa(String.fromCharCode(...args.iv));
  const authTagBase64 = btoa(String.fromCharCode(...authTag));
  const encryptedBase64 = btoa(String.fromCharCode(...ciphertext));

  // Combine iv:authTag:encrypted
  return `${ivBase64}:${authTagBase64}:${encryptedBase64}`;
}
