import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
    private readonly algorithm = 'aes-256-gcm';
    private readonly logger = new Logger(EncryptionService.name);
    private readonly key: Buffer;

    constructor() {
        // ENCRYPTION_KEY management
        const keyString = process.env.ENCRYPTION_KEY;

        if (!keyString) {
            this.logger.warn("ENCRYPTION_KEY not set. Using insecure fallback key. DO NOT USE IN PRODUCTION.");
            this.key = crypto.createHash('sha256').update('fallback-insecure-key').digest();
        } else {
            // Robustly strictly derive a 32-byte key from the provided string properly
            // consistently using SHA-256. This ensures it works whether the user
            // provided a hex string, a database URL, or a random phrase.
            this.key = crypto.createHash('sha256').update(keyString).digest();
            this.logger.log("Encryption key initialized successfully (using SHA-256 derivation)");
        }
    }

    encrypt(text: string): { iv: string; content: string } {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const authTag = cipher.getAuthTag().toString('hex');

        // Return IV and Encrypted Content (including auth tag appended or handled separately)
        // For simplicity, we can append authTag to content or return it. 
        // GCM requires Auth Tag for decryption verification.
        return {
            iv: iv.toString('hex'),
            content: encrypted + ':' + authTag
        };
    }

    decrypt(encryptedData: string, ivHex: string): string {
        const [content, authTagHex] = encryptedData.split(':');
        if (!content || !authTagHex) throw new Error('Invalid encrypted data format');

        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');

        const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(content, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    }
}
