import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY;
    if (!key || key.length < 32) {
        throw new Error(
            'ENCRYPTION_KEY must be set and at least 32 characters long'
        );
    }
    // Use SHA-256 hash of the key to get exactly 32 bytes
    return crypto.createHash('sha256').update(key).digest();
}

export function encrypt(plaintext: string): string {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    // Format: iv:tag:ciphertext (all hex)
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

export function decrypt(ciphertext: string): string {
    const key = getEncryptionKey();
    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
        throw new Error('Invalid encrypted format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}

export function maskSecret(secret: string, visibleChars: number = 4): string {
    if (secret.length <= visibleChars) {
        return '•'.repeat(secret.length);
    }
    const suffix = secret.slice(-visibleChars);
    return `${'•'.repeat(Math.min(secret.length - visibleChars, 12))}${suffix}`;
}
