// VaultBox: Enhanced encryption utility for secure vault management
// All encryption/decryption happens client-side using the Web Crypto API

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
 * Encrypts a file and returns the encrypted data as a base64 string
 */
export async function encryptFile(file: File, key: CryptoKey): Promise<{
  encryptedData: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}> {
  // Read the file as an ArrayBuffer
  const fileBuffer = await file.arrayBuffer();
  
  // Create an initialization vector
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
  // Encrypt the file data
  const ciphertext = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    fileBuffer
  );
  
  // Combine IV and ciphertext
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  
  // Return encrypted data and file metadata
  return {
    encryptedData: arrayBufferToBase64(combined),
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size
  };
}

/**
 * Decrypts a file and returns it as a File object
 */
export async function decryptFile(
  encryptedData: string, 
  fileName: string, 
  fileType: string, 
  key: CryptoKey
): Promise<File> {
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
    
    // Create a new File from the decrypted data
    return new File([decrypted], fileName, { type: fileType });
  } catch (error) {
    console.error("File decryption failed:", error);
    throw new Error("Failed to decrypt file");
  }
}

/**
 * Generates a secure sharing key for emergency access
 */
export async function generateSharingKey(): Promise<CryptoKey> {
  return await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]), // 65537
      hash: "SHA-256",
    },
    true, // extractable
    ["encrypt", "decrypt"]
  );
}

/**
 * Exports a public key for sharing with trusted contacts
 */
export async function exportPublicKey(keyPair: CryptoKeyPair): Promise<string> {
  const exported = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
  return arrayBufferToBase64(exported);
}

/**
 * Exports a private key securely (for backup purposes)
 */
export async function exportPrivateKey(keyPair: CryptoKeyPair): Promise<string> {
  const exported = await window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
  return arrayBufferToBase64(exported);
}

/**
 * Imports a public key from base64 string
 */
export async function importPublicKey(publicKeyString: string): Promise<CryptoKey> {
  const keyData = base64ToArrayBuffer(publicKeyString);
  return await window.crypto.subtle.importKey(
    "spki",
    keyData,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    true,
    ["encrypt"]
  );
}

/**
 * Imports a private key from base64 string
 */
export async function importPrivateKey(privateKeyString: string): Promise<CryptoKey> {
  const keyData = base64ToArrayBuffer(privateKeyString);
  return await window.crypto.subtle.importKey(
    "pkcs8",
    keyData,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    true,
    ["decrypt"]
  );
}

/**
 * Encrypts a symmetric key with a public key for secure sharing
 */
export async function encryptSymmetricKey(
  symmetricKey: CryptoKey, 
  publicKey: CryptoKey
): Promise<string> {
  // Export the symmetric key
  const exportedKey = await window.crypto.subtle.exportKey("raw", symmetricKey);
  
  // Encrypt with the public key
  const encryptedKey = await window.crypto.subtle.encrypt(
    {
      name: "RSA-OAEP",
    },
    publicKey,
    exportedKey
  );
  
  return arrayBufferToBase64(encryptedKey);
}

/**
 * Decrypts a symmetric key with a private key
 */
export async function decryptSymmetricKey(
  encryptedKeyString: string, 
  privateKey: CryptoKey
): Promise<CryptoKey> {
  // Convert from base64
  const encryptedKey = base64ToArrayBuffer(encryptedKeyString);
  
  // Decrypt with the private key
  const decryptedKey = await window.crypto.subtle.decrypt(
    {
      name: "RSA-OAEP",
    },
    privateKey,
    encryptedKey
  );
  
  // Import as AES-GCM key
  return await window.crypto.subtle.importKey(
    "raw",
    decryptedKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"]
  );
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

/**
 * Securely store a master key in the browser for the session
 */
export function storeMasterKey(key: CryptoKey): void {
  // This is a simple implementation for demo purposes
  // In a real app, you might want to use a more secure approach
  // such as storing an encrypted version of the key
  if (typeof window !== 'undefined') {
    (window as any)._vaultMasterKey = key;
  }
}

/**
 * Retrieve the master key from storage
 */
export function getMasterKey(): CryptoKey | null {
  if (typeof window !== 'undefined') {
    return (window as any)._vaultMasterKey || null;
  }
  return null;
}

/**
 * Clear the master key from storage (for logout)
 */
export function clearMasterKey(): void {
  if (typeof window !== 'undefined') {
    delete (window as any)._vaultMasterKey;
  }
}

/**
 * Generate a secure emergency access key
 */
export function generateEmergencyAccessKey(): string {
  // Generate 16 random bytes
  const bytes = window.crypto.getRandomValues(new Uint8Array(16));
  
  // Convert to a formatted string (e.g., XXXX-XXXX-XXXX-XXXX)
  const groups = [];
  for (let i = 0; i < bytes.length; i += 4) {
    const group = Array.from(bytes.slice(i, i + 4))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    groups.push(group);
  }
  
  return groups.join('-').toUpperCase();
}

/**
 * Hash a value securely (for verification purposes)
 */
export async function hashValue(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  return arrayBufferToBase64(hashBuffer);
}

/**
 * Calculate file hash for integrity verification
 */
export async function calculateFileHash(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', arrayBuffer);
  return arrayBufferToBase64(hashBuffer);
}
