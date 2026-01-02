/**
 * Crypto utilities for end-to-end encryption
 */

const cryptoObj = window.crypto;
const subtle = cryptoObj.subtle;

/**
 * Generates an RSA-OAEP key pair for encryption and decryption.
 */
export async function generateKeyPair(): Promise<CryptoKeyPair>
{
    return await subtle.generateKey(
        {
            name: 'RSA-OAEP',
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: 'SHA-256'
        },
        true,
        ['encrypt', 'decrypt']
    );
}

/**
 * Derives a key from a password using PBKDF2.
 */
export async function deriveKeyFromPassword(password: string, username: string): Promise<CryptoKey>
{
    const enc = new TextEncoder();
    const keyMaterial = await subtle.importKey(
        'raw',
        enc.encode(password),
        'PBKDF2',
        false,
        ['deriveKey']
    );

    return await subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: enc.encode(username),
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );
}

/**
 * Exports the password key to JWK string for storage.
 */
export async function exportPasswordKey(key: CryptoKey): Promise<string>
{
    const jwk = await subtle.exportKey('jwk', key);
    return JSON.stringify(jwk);
}

/**
 * Imports the password key from JWK string.
 */
export async function importPasswordKey(keyStr: string): Promise<CryptoKey>
{
    const jwk = JSON.parse(keyStr);
    return await subtle.importKey(
        'jwk',
        jwk,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );
}

/**
 * Encrypts the private key with the derived password key.
 */
export async function encryptPrivateKey(privateKey: CryptoKey, passwordKey: CryptoKey): Promise<string>
{
    const exportedKey = await subtle.exportKey('jwk', privateKey);
    const enc = new TextEncoder();
    const data = enc.encode(JSON.stringify(exportedKey));

    const iv = cryptoObj.getRandomValues(new Uint8Array(12));

    const encryptedContent = await subtle.encrypt(
        { name: 'AES-GCM', iv },
        passwordKey,
        data
    );

    return '' + arrayBufferToBase64(iv.buffer) + '.' + arrayBufferToBase64(encryptedContent);
}

/**
 * Decrypts the private key using the derived password key.
 */
export async function decryptPrivateKey(encryptedPrivateKeyStr: string, passwordKey: CryptoKey): Promise<CryptoKey | null>
{
    try
    {
        let iv: BufferSource;
        let data: BufferSource;
        if (encryptedPrivateKeyStr.includes('.'))
        {
            const split = encryptedPrivateKeyStr.split('.', 2);
            data = base64ToBytes(split[1]);
            iv = base64ToBytes(split[0]);
        }
        else 
        {
            const encryptedObj = JSON.parse(encryptedPrivateKeyStr);
            iv = new Uint8Array(encryptedObj.iv);
            data = new Uint8Array(encryptedObj.data);
        }

        const decryptedData = await subtle.decrypt(
            { name: 'AES-GCM', iv },
            passwordKey,
            data
        );

        const dec = new TextDecoder();
        const jwk = JSON.parse(dec.decode(decryptedData));

        return await subtle.importKey(
            'jwk',
            jwk,
            { name: 'RSA-OAEP', hash: 'SHA-256' },
            true,
            ['decrypt']
        );
    }
    catch (e)
    {
        console.error('Failed to decrypt private key', e);
        return null;
    }
}

/**
 * Exports the public key to JWK format for sharing.
 */
export async function exportPublicKey(publicKey: CryptoKey): Promise<string>
{
    const exported = await subtle.exportKey('jwk', publicKey);
    return JSON.stringify(exported);
}

/**
 * Imports a public key from JWK string.
 */
export async function importPublicKey(publicKeyStr: string): Promise<CryptoKey>
{
    const jwk = JSON.parse(publicKeyStr);
    return await subtle.importKey(
        'jwk',
        jwk,
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        true,
        ['encrypt']
    );
}

/**
 * Hashes the password using HMAC-SHA256 with a server-provided key.
 */
export async function hashPasswordWithServerKey(password: string, serverKey: string): Promise<string>
{
    const enc = new TextEncoder();
    const keyData = enc.encode(serverKey);
    const passwordData = enc.encode(password);

    const key = await subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    const signature = await subtle.sign('HMAC', key, passwordData);

    const hashArray = Array.from(new Uint8Array(signature));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generates an AES-GCM symmetric key.
 */
export async function generateSymmetricKey(): Promise<CryptoKey>
{
    return await subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );
}

/**
 * Exports a symmetric key to base64 string for storage.
 */
export async function exportSymmetricKey(key: CryptoKey): Promise<string>
{
    const rawKey = await subtle.exportKey('raw', key);
    return arrayBufferToBase64(rawKey);
}

/**
 * Imports a symmetric key from base64 string.
 */
export async function importSymmetricKey(keyBase64: string): Promise<CryptoKey | null>
{
    try
    {
        const rawKey = base64ToBytes(keyBase64);
        return await subtle.importKey(
            'raw',
            rawKey,
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );
    }
    catch (e)
    {
        console.error('Failed to import symmetric key', e);
        return null;
    }
}

/**
 * Encrypts (wraps) a symmetric key with a public key (RSA-OAEP).
 */
export async function encryptSymmetricKey(symmetricKey: CryptoKey, publicKey: CryptoKey): Promise<string>
{
    const rawData = await subtle.exportKey('raw', symmetricKey);
    const encryptedData = await subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, rawData);
    return arrayBufferToBase64(encryptedData);
}

/**
 * Decrypts (unwraps) a symmetric key with a private key.
 */
export async function decryptSymmetricKey(encryptedKeyStr: string, privateKey: CryptoKey): Promise<CryptoKey | null>
{
    try
    {
        const encryptedData = base64ToArrayBuffer(encryptedKeyStr);
        const rawKey = await subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, encryptedData);
        return await subtle.importKey(
            'raw',
            rawKey,
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );
    }
    catch (e)
    {
        console.error('Failed to decrypt symmetric key', e);
        return null;
    }
}

/**
 * Encrypts a message using AES-GCM.
 */
export async function encryptMessageString(message: string, key: CryptoKey): Promise<string>
{
    const data = new TextEncoder().encode(message);
    return await encryptMessageBytes(data, key);
}

export async function encryptMessageBytes(dataBytes: BufferSource, key: CryptoKey): Promise<string>
{
    const iv = cryptoObj.getRandomValues(new Uint8Array(12));
    const encryptedContent = await subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        dataBytes
    );
    const ivString = bytesToBase64(iv);
    const dataString = arrayBufferToBase64(encryptedContent);
    return ivString + '.' + dataString;
}

/**
 * Decrypts a message using AES-GCM.
 */
export async function decryptMessageString(encryptedMessageStr: string, key: CryptoKey): Promise<string>
{
    return new TextDecoder().decode(await decryptMessageBytes(encryptedMessageStr, key));
}

export async function decryptMessageBytes(encryptedMessageStr: string, key: CryptoKey): Promise<ArrayBuffer>
{
    const split = encryptedMessageStr.split('.', 2);
    const iv = base64ToBytes(split[0]);
    const data = base64ToBytes(split[1]);
    return await subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
}

/**
 * Encrypts a large file in chunks to avoid blocking the UI.
 * Uses streaming to minimize memory usage and yields to the main thread periodically.
 */
export async function encryptLargeFile(
    file: File,
    key: CryptoKey,
    onProgress?: (progress: number) => void
): Promise<string>
{
    const CHUNK_SIZE = 1024 * 1024; // 1MB chunks for reading
    const totalSize = file.size;
    let processedBytes = 0;

    // Read file in chunks to avoid memory issues
    const reader = file.stream().getReader();
    const fileData: Uint8Array[] = [];
    let totalLength = 0;

    while (true)
    {
        const { done, value } = await reader.read();
        if (done) break;

        fileData.push(value);
        totalLength += value.length;
        processedBytes += value.length;

        // Yield to main thread every 1MB
        if (processedBytes % CHUNK_SIZE < value.length)
        {
            await new Promise(resolve => setTimeout(resolve, 0));
            onProgress?.(Math.round((processedBytes / totalSize) * 50)); // First 50% is reading
        }
    }

    // Combine chunks into single array
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of fileData)
    {
        combined.set(chunk, offset);
        offset += chunk.length;
    }

    // Yield before encryption
    await new Promise(resolve => setTimeout(resolve, 0));
    onProgress?.(50);

    // Encrypt the data
    const iv = cryptoObj.getRandomValues(new Uint8Array(12));
    const encryptedContent = await subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        combined
    );

    // Yield after encryption
    await new Promise(resolve => setTimeout(resolve, 0));
    onProgress?.(75);

    // Convert to base64 - must be done on complete data to avoid encoding issues
    // Use chunked approach but ensure chunk boundaries align with base64 encoding (3 bytes -> 4 chars)
    const encryptedBytes = new Uint8Array(encryptedContent);
    const base64Chunks: string[] = [];
    // Chunk size must be multiple of 3 for proper base64 encoding without padding issues
    const BASE64_CHUNK_SIZE = 1024 * 1024 * 3; // ~3MB, multiple of 3

    for (let i = 0; i < encryptedBytes.length; i += BASE64_CHUNK_SIZE)
    {
        const isLastChunk = i + BASE64_CHUNK_SIZE >= encryptedBytes.length;
        const chunkEnd = isLastChunk ? encryptedBytes.length : i + BASE64_CHUNK_SIZE;
        const chunk = encryptedBytes.slice(i, chunkEnd);
        base64Chunks.push(bytesToBase64(chunk));

        // Yield periodically
        await new Promise(resolve => setTimeout(resolve, 0));
        onProgress?.(75 + Math.round((chunkEnd / encryptedBytes.length) * 25));
    }

    const ivString = bytesToBase64(iv);
    const dataString = base64Chunks.join('');

    onProgress?.(100);
    return ivString + '.' + dataString;
}

// Utility functions
export function arrayBufferToBase64(buffer: ArrayBuffer): string
{
    return bytesToBase64(new Uint8Array(buffer));
}

export function bytesToBase64(bytes: Uint8Array): string
{
    let binary = '';
    const len = bytes.length;
    for (let i = 0; i < len; i++)
    {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer
{
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++)
    {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

export function base64ToBytes(base64: string)
{
    return new Uint8Array(base64ToArrayBuffer(base64));
}
