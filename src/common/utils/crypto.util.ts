import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';

export function encrypt(text: string, secretKey: string): string {
  if (!text) return '';
  try {
    // Generate a 32-byte key from the secret
    const key = crypto.createHash('sha256').update(secretKey).digest();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('Encryption error:', error);
    return text;
  }
}

export function decrypt(text: string, secretKey: string): string {
  if (!text || !text.includes(':')) return text;
  try {
    const key = crypto.createHash('sha256').update(secretKey).digest();
    const [ivHex, encrypted] = text.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    return text;
  }
}

export function maskValue(value: string): string {
  if (!value) return '';
  if (value.length <= 4) return '****';
  return `${value.substring(0, 2)}****${value.substring(value.length - 2)}`;
}
