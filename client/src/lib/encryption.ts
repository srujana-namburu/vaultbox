// This file handles client-side encryption/decryption using Web Crypto API

/**
 * Generates a random encryption key
 */
export async function generateEncryptionKey(): Promise<CryptoKey> {
  return await window.crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256,
    },
    true, // extractable
    ["encrypt", "decrypt"]
  );
}

/**
 * Exports CryptoKey to base64 string
 */
export async function exportKey(key: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey("raw", key);
  return arrayBufferToBase64(exported);
}

/**
 * Imports a base64 string to CryptoKey
 */
export async function importKey(keyString: string): Promise<CryptoKey> {
  const keyData = base64ToArrayBuffer(keyString);
  return await window.crypto.subtle.importKey(
    "raw",
    keyData,
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts data with the provided key
 */
export async function encryptData(data: any, key: CryptoKey): Promise<string> {
  // Convert data to string if it's not already
  const jsonString = typeof data === "string" ? data : JSON.stringify(data);
  
  // Create an initialization vector
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
  // Encrypt the data
  const encoded = new TextEncoder().encode(jsonString);
  const ciphertext = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    encoded
  );
  
  // Combine IV and ciphertext
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  
  // Return as base64 string
  return arrayBufferToBase64(combined);
}

/**
 * Decrypts data with the provided key
 */
export async function decryptData(encryptedData: string, key: CryptoKey): Promise<any> {
  try {
    // Convert base64 back to ArrayBuffer
    const data = base64ToArrayBuffer(encryptedData);
    
    // Extract the IV
    const iv = data.slice(0, 12);
    
    // Extract the ciphertext
    const ciphertext = data.slice(12);
    
    // Decrypt
    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv,
      },
      key,
      ciphertext
    );
    
    // Decode and parse if it's JSON
    const decoded = new TextDecoder().decode(decrypted);
    try {
      return JSON.parse(decoded);
    } catch (e) {
      // If it's not valid JSON, return as string
      return decoded;
    }
  } catch (error) {
    console.error("Decryption failed:", error);
    throw new Error("Failed to decrypt data");
  }
}

/**
 * Helper to convert ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Helper to convert base64 string to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Creates a user-specific master key derived from their password
 * Note: In a production app, this would be combined with a server-provided salt
 */
export async function deriveKeyFromPassword(password: string, salt?: string): Promise<CryptoKey> {
  // If no salt is provided, use a default one
  // In a real app, this would be a unique salt per user stored on the server
  const useSalt = salt || "VaultBox-Salt-439852";
  
  // Convert password and salt to buffers
  const passwordBuffer = new TextEncoder().encode(password);
  const saltBuffer = new TextEncoder().encode(useSalt);
  
  // Import password as a key
  const passwordKey = await window.crypto.subtle.importKey(
    "raw",
    passwordBuffer,
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );
  
  // Derive a key using PBKDF2
  return await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBuffer,
      iterations: 100000,
      hash: "SHA-256",
    },
    passwordKey,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}
