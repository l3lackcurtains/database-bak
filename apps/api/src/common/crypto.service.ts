import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

@Injectable()
export class CryptoService {
  private key: Buffer;

  constructor() {
    const raw = process.env.ENCRYPTION_KEY;
    if (!raw) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }
    this.key =
      raw.length === 64 && /^[0-9a-f]{64}$/i.test(raw)
        ? Buffer.from(raw, 'hex')
        : crypto.createHash('sha256').update(raw).digest();
  }

  encrypt(plaintext: string): string {
    if (!plaintext) return '';
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);
    let encrypted = cipher.update(plaintext, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, encrypted, tag]).toString('base64');
  }

  decrypt(ciphertext: string): string {
    if (!ciphertext) return '';
    try {
      const buf = Buffer.from(ciphertext, 'base64');
      if (buf.length < IV_LENGTH + TAG_LENGTH) return '';
      const iv = buf.subarray(0, IV_LENGTH);
      const tag = buf.subarray(buf.length - TAG_LENGTH);
      const encrypted = buf.subarray(IV_LENGTH, buf.length - TAG_LENGTH);
      const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);
      decipher.setAuthTag(tag);
      const decrypted = decipher.update(encrypted);
      return Buffer.concat([decrypted, decipher.final()]).toString('utf8');
    } catch {
      return '';
    }
  }
}
