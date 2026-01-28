import { Injectable, Logger } from '@nestjs/common';
import { Twilio } from 'twilio';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/encryption.service';

@Injectable()
export class TwilioService {
    private readonly logger = new Logger(TwilioService.name);

    constructor(
        private prisma: PrismaService,
        private encryptionService: EncryptionService
    ) { }

    /**
     * Gets a Twilio client for a specific doctor
     */
    async getClient(userId: string) {
        const config = await this.prisma.doctorSmsConfig.findUnique({
            where: { userId }
        });

        if (!config) {
            this.logger.warn(`No SMS config found for user ${userId}`);
            return null;
        }

        try {
            const authToken = this.encryptionService.decrypt(config.authTokenEncrypted, config.iv);
            const client = new Twilio(config.accountSid, authToken);
            return { client, config };
        } catch (error) {
            this.logger.error(`Failed to create Twilio client for ${userId}: ${error.message}`);
            return null;
        }
    }

    /**
     * Verifies the Twilio connection
     */
    async verifyConnection(userId: string): Promise<{ success: boolean; message?: string }> {
        const result = await this.getClient(userId);
        if (!result) {
            return { success: false, message: 'Configuration not found or invalid' };
        }

        try {
            // Test by fetching account details
            await result.client.api.v2010.accounts(result.config.accountSid).fetch();
            return { success: true };
        } catch (error) {
            this.logger.error(`Twilio Verification Failed for ${userId}: ${error.message}`);
            return { success: false, message: error.message };
        }
    }

    /**
     * Sends an SMS
     * @param from - Can be a phone number or alphanumeric sender ID
     * @param to - Recipient phone number
     * @param body - Message content
     * @param userId - Optional user ID for personal Twilio config (falls back to system)
     */
    async sendSms(from: string, to: string, body: string, userId?: string) {
        let client: Twilio;

        // Forcing system default as requested
        /*
        if (userId) {
             // ... (User logic disabled)
        }
        */
        client = this.getSystemClient();

        return client.messages.create({
            body,
            from, // Can be phone number or alphanumeric ID
            to
        });
    }

    /**
     * Gets system Twilio client
     */
    private getSystemClient(): Twilio {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;

        if (!accountSid || !authToken) {
            throw new Error('System Twilio credentials not configured');
        }

        return new Twilio(accountSid, authToken);
    }

    /**
     * Sends a WhatsApp message
     */
    async sendWhatsapp(userId: string, to: string, body: string) {
        const result = await this.getClient(userId);
        if (!result) throw new Error("WhatsApp Configuration missing");

        const { client, config } = result;
        const from = config.whatsappNumber || `whatsapp:${config.phoneNumber}`;

        // Ensure 'to' has whatsapp: prefix
        const toAddress = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

        return client.messages.create({
            body,
            from: from.startsWith('whatsapp:') ? from : `whatsapp:${from}`,
            to: toAddress
        });
    }
}
