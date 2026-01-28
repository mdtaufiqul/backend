import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppTier } from '@prisma/client';
import { EncryptionService } from '../common/encryption.service';

export interface WhatsAppIdentity {
    tier: WhatsAppTier;
    from: string;
    sessionKey?: string;
    displayName?: string;
}

@Injectable()
export class WhatsAppTierService {
    private readonly logger = new Logger(WhatsAppTierService.name);

    constructor(
        private prisma: PrismaService,
        private encryptionService: EncryptionService,
    ) { }

    /**
     * Sends WhatsApp message using the appropriate tier
     * Tier 1: Meta Official (via Twilio)
     * Tier 2: QR Code (via Evolution API)
     * Tier 3: System Fallback (Platform's Twilio WhatsApp number)
     */
    async sendWhatsApp(doctorId: string, to: string, message: string): Promise<void> {
        const doctor = await this.prisma.user.findUnique({
            where: { id: doctorId },
            select: {
                whatsappTier: true,
                metaBusinessId: true,
                metaAccessToken: true,
                metaTokenIv: true,
                whatsappQrSession: true,
                whatsappQrExpiry: true,
                whatsappPhoneNumber: true,
                name: true,
            },
        });

        if (!doctor) {
            throw new Error(`Doctor ${doctorId} not found`);
        }

        // Tier 1: Meta Official
        if (doctor.whatsappTier === 'META_OFFICIAL' && doctor.metaBusinessId && doctor.metaAccessToken) {
            this.logger.log(`Sending WhatsApp via Meta Official for doctor ${doctorId}`);
            await this.sendViaMeta(doctor, to, message);
            return;
        }

        // Tier 2: QR Code
        if (doctor.whatsappTier === 'QR_CODE' && doctor.whatsappQrSession) {
            // Check if session is still valid
            if (doctor.whatsappQrExpiry && doctor.whatsappQrExpiry > new Date()) {
                this.logger.log(`Sending WhatsApp via QR Code session for doctor ${doctorId}`);
                const testMessage = `${message}\n\n👉 *Reply with "YES"* to verify we can receive your messages!`;
                await this.sendViaQrCode(doctor.whatsappQrSession, to, testMessage);
                return;
            } else {
                this.logger.warn(`QR session expired for doctor ${doctorId}, falling back to system`);
            }
        }

        // Tier 3: System Fallback
        this.logger.log(`Sending WhatsApp via system fallback for doctor ${doctorId}`);
        const testMessage = `${message}\n\n👉 *Reply with "YES"* to verify we can receive your messages!`;
        await this.sendViaSystem(to, testMessage);
    }

    /**
     * Tier 1: Send via Meta Business API (through Twilio)
     */
    private async sendViaMeta(doctor: any, to: string, message: string): Promise<void> {


        // Decrypt Meta access token
        const accessToken = this.encryptionService.decrypt(
            doctor.metaAccessToken,
            doctor.metaTokenIv,
        );

        // Use Twilio's WhatsApp API with Meta Business integration
        const twilio = require('twilio');
        const client = twilio(
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_AUTH_TOKEN,
        );

        await client.messages.create({
            from: `whatsapp:${doctor.whatsappPhoneNumber}`,
            to: `whatsapp:${to}`,
            body: message,
        });

        this.logger.log(`WhatsApp sent via Meta Official to ${to}`);
    }

    /**
     * Tier 2: Send Interactive Button Message via Evolution API
     */
    private async sendViaQrInteractive(sessionKey: string, to: string, title: string, description: string, buttons: { id: string, displayText: string }[]): Promise<void> {
        const evolutionApiUrl = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
        const evolutionApiKey = process.env.EVOLUTION_API_KEY;

        const response = await fetch(`${evolutionApiUrl}/message/sendButtons/${sessionKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': evolutionApiKey!,
            },
            body: JSON.stringify({
                number: to.replace(/[^0-9]/g, ''),
                title,
                description,
                buttons: buttons.map(b => ({ type: "reply", copyText: b.displayText })), // Evolution format check needed, using common format
            }),
        });

        // If 404/Error, fallback to text (Evolution API might not support buttons on all versions/numbers)
        if (!response.ok) {
            throw new Error(`Evolution API Button error: ${response.statusText}`);
        }
        this.logger.log(`Interactive WhatsApp sent to ${to}`);
    }

    /**
     * Tier 2: Send via QR Code session (Evolution API)
     */
    private async sendViaQrCode(sessionKey: string, to: string, message: string): Promise<void> {
        const evolutionApiUrl = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
        const evolutionApiKey = process.env.EVOLUTION_API_KEY;

        if (!evolutionApiKey) {
            throw new Error('EVOLUTION_API_KEY not configured');
        }

        // Helper to normalize number (default to BD if missing country code)
        let formattedTo = to.replace(/[^0-9]/g, '');
        if (formattedTo.startsWith('01')) {
            formattedTo = '88' + formattedTo;
        }

        // Send message via Evolution API
        const payload = {
            number: formattedTo,
            text: message,
        };

        try {
            const response = await fetch(`${evolutionApiUrl}/message/sendText/${sessionKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': evolutionApiKey,
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorText = await response.text();
                this.logger.error(`Evolution API Error (${response.status}): ${errorText}`);
                this.logger.error(`Payload sent: ${JSON.stringify(payload)}`);
                throw new Error(`Evolution API error: ${response.statusText} - ${errorText}`);
            }

            this.logger.log(`WhatsApp sent via QR Code to ${to}`);
        } catch (error) {
            this.logger.error(`Failed to connect to Evolution API at ${evolutionApiUrl}. Error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Tier 3: Send via system Twilio WhatsApp number
     */
    /**
     * Tier 3: Send via system Twilio WhatsApp number OR System QR Session
     */
    async sendViaSystem(to: string, message: string): Promise<void> {
        // 1. Try System QR Session (Evolution API) first if configured
        try {
            const systemSessionName = 'mediflow_system_main';
            const evolutionApiUrl = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
            const evolutionApiKey = process.env.EVOLUTION_API_KEY;

            if (evolutionApiKey) {
                // Check connection state first (optional but safer)
                // For performance, we might just try to send
                await this.sendViaQrCode(systemSessionName, to, message);
                this.logger.log(`WhatsApp sent via System QR Session to ${to}`);
                return;
            }
        } catch (error) {
            // Log but fallback to Twilio
            this.logger.warn(`Failed to send via System QR: ${error.message}. Falling back to Twilio.`);
        }

        // 2. Fallback to Twilio System Number
        const systemWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER;

        if (!systemWhatsAppNumber) {
            throw new Error('TWILIO_WHATSAPP_NUMBER not configured and System QR failed');
        }

        const twilio = require('twilio');
        const client = twilio(
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_AUTH_TOKEN,
        );

        const fromNumber = systemWhatsAppNumber.startsWith('whatsapp:')
            ? systemWhatsAppNumber
            : `whatsapp:${systemWhatsAppNumber}`;

        const toNumber = to.startsWith('whatsapp:')
            ? to
            : `whatsapp:${to}`;

        await client.messages.create({
            from: fromNumber,
            to: toNumber,
            body: message,
        });

        this.logger.log(`WhatsApp sent via system fallback (Twilio) to ${to}`);
    }

    async generateSystemQrCode(): Promise<string> {
        const sessionName = 'mediflow_system_main';
        const evolutionApiUrl = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
        const evolutionApiKey = process.env.EVOLUTION_API_KEY;

        if (!evolutionApiKey) throw new Error('EVOLUTION_API_KEY not configured');

        const response = await fetch(`${evolutionApiUrl}/instance/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': evolutionApiKey,
            },
            body: JSON.stringify({
                instanceName: sessionName,
                integration: 'WHATSAPP-BAILEYS',
                qrcode: true,
                webhook: {
                    url: `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/webhooks/evolution`,
                    events: ['MESSAGES_UPSERT'],
                    enabled: true,
                },
            }),
        });

        const data = await response.json();
        if (!data.qrcode?.base64) {
            // If instance already exists, maybe delete it first?
            // For now, assume we might need to logout if it exists but is disconnected
            // But usually create returns error if exists.
            if (data?.instance?.status === 'OPEN') {
                throw new Error('System instance already connected');
            }
            // Try fetching connect QR if already created
            const connectRes = await fetch(`${evolutionApiUrl}/instance/connect/${sessionName}`, {
                headers: { 'apikey': evolutionApiKey }
            });
            const connectData = await connectRes.json();
            if (connectData?.base64) return connectData.base64;

            throw new Error('Failed to generate System QR code');
        }

        return data.qrcode.base64;
    }

    async verifySystemQrSession(): Promise<boolean> {
        const sessionName = 'mediflow_system_main';
        const evolutionApiUrl = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
        const evolutionApiKey = process.env.EVOLUTION_API_KEY;

        const response = await fetch(`${evolutionApiUrl}/instance/connectionState/${sessionName}`, {
            headers: { 'apikey': evolutionApiKey! },
        });

        const data = await response.json();
        return data?.instance?.state === 'open';
    }

    /**
     * Link Meta Business Account (Tier 1 setup)
     */
    async linkMetaBusiness(doctorId: string, code: string): Promise<void> {

        // Exchange code for access token via Meta OAuth
        const response = await fetch('https://graph.facebook.com/v18.0/oauth/access_token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: process.env.META_APP_ID,
                client_secret: process.env.META_APP_SECRET,
                code,
                redirect_uri: process.env.META_REDIRECT_URI,
            }),
        });

        const data = await response.json();

        if (!data.access_token) {
            throw new Error('Failed to get Meta access token');
        }

        // Encrypt and store access token
        const { content: encrypted, iv } = this.encryptionService.encrypt(data.access_token);

        // Get WhatsApp Business Account ID
        const wabaResponse = await fetch(
            `https://graph.facebook.com/v18.0/me/accounts?access_token=${data.access_token}`,
        );
        const wabaData = await wabaResponse.json();
        const businessId = wabaData.data?.[0]?.id;

        if (!businessId) {
            throw new Error('No Meta Business Account found');
        }

        // Update doctor's WhatsApp configuration
        await this.prisma.user.update({
            where: { id: doctorId },
            data: {
                whatsappTier: 'META_OFFICIAL',
                metaBusinessId: businessId,
                metaAccessToken: encrypted,
                metaTokenIv: iv,
            },
        });

        this.logger.log(`Meta Business linked for doctor ${doctorId}`);
    }

    /**
     * Get Meta OAuth URL
     */
    getMetaAuthUrl(): string {
        const appId = process.env.META_APP_ID;
        const redirectUri = process.env.META_REDIRECT_URI;
        const scope = 'whatsapp_business_management,whatsapp_business_messaging';
        return `https://www.facebook.com/v18.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&state=mediflow_binding&scope=${scope}&response_type=code`;
    }

    async disconnectMeta(doctorId: string): Promise<void> {
        await this.prisma.user.update({
            where: { id: doctorId },
            data: {
                metaBusinessId: null,
                metaAccessToken: null,
                metaTokenIv: null,
                whatsappTier: 'SYSTEM_FALLBACK', // Revert to fallback if disconnected
            },
        });
        this.logger.log(`Meta Business disconnected for doctor ${doctorId}`);
    }

    async disconnectQr(doctorId: string): Promise<void> {
        const doctor = await this.prisma.user.findUnique({ where: { id: doctorId }, select: { whatsappQrSession: true } });

        if (doctor?.whatsappQrSession) {
            const evolutionApiUrl = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
            const evolutionApiKey = process.env.EVOLUTION_API_KEY;

            try {
                await fetch(`${evolutionApiUrl}/instance/logout/${doctor.whatsappQrSession}`, {
                    method: 'DELETE',
                    headers: { 'apikey': evolutionApiKey! },
                });
            } catch (e) {
                this.logger.warn(`Failed to logout evolution session: ${e.message}`);
            }
        }

        await this.prisma.user.update({
            where: { id: doctorId },
            data: {
                whatsappQrSession: null,
                whatsappQrExpiry: null,
                whatsappTier: 'SYSTEM_FALLBACK', // Revert to fallback
            },
        });
        this.logger.log(`QR Session disconnected for doctor ${doctorId}`);
    }

    /**
     * Generate QR Code for WhatsApp setup (Tier 2)
     */
    async generateQrCode(doctorId: string): Promise<string> {
        const evolutionApiUrl = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
        const evolutionApiKey = process.env.EVOLUTION_API_KEY;

        if (!evolutionApiKey) {
            throw new Error('EVOLUTION_API_KEY not configured');
        }

        // Create a unique session name for this doctor
        const sessionName = `doctor_${doctorId}_${Date.now()}`;

        // Request QR code from Evolution API
        const response = await fetch(`${evolutionApiUrl}/instance/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': evolutionApiKey,
            },
            body: JSON.stringify({
                instanceName: sessionName,
                integration: 'WHATSAPP-BAILEYS',
                qrcode: true,
                webhook: {
                    url: `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/webhooks/evolution`,
                    events: ['MESSAGES_UPSERT'],
                    enabled: true,
                },
            }),
        });

        const data = await response.json();

        if (!data.qrcode?.base64) {
            throw new Error('Failed to generate QR code');
        }

        // Store session info temporarily (will be verified after scan)
        await this.prisma.user.update({
            where: { id: doctorId },
            data: {
                whatsappQrSession: sessionName,
                whatsappQrExpiry: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes to scan
            },
        });

        this.logger.log(`QR code generated for doctor ${doctorId}`);

        // Return base64 QR code image
        return data.qrcode.base64;
    }

    /**
     * Verify QR Code session after scanning (Tier 2)
     */
    async verifyQrSession(doctorId: string): Promise<boolean> {
        const doctor = await this.prisma.user.findUnique({
            where: { id: doctorId },
            select: { whatsappQrSession: true },
        });

        if (!doctor?.whatsappQrSession) {
            return false;
        }

        const evolutionApiUrl = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
        const evolutionApiKey = process.env.EVOLUTION_API_KEY;

        // Check if session is connected
        const response = await fetch(
            `${evolutionApiUrl}/instance/connectionState/${doctor.whatsappQrSession}`,
            {
                headers: { 'apikey': evolutionApiKey! },
            },
        );

        const data = await response.json();

        if (data?.instance?.state === 'open') {
            // Session is connected, update tier and extend expiry
            await this.prisma.user.update({
                where: { id: doctorId },
                data: {
                    whatsappTier: 'QR_CODE',
                    whatsappQrExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 365 days (1 year)
                },
            });

            this.logger.log(`QR session verified for doctor ${doctorId}`);
            return true;
        }


        return false;
    }

    /**
     * Manually set the active WhatsApp Tier
     */
    async updateTier(doctorId: string, tier: WhatsAppTier): Promise<void> {
        await this.prisma.user.update({
            where: { id: doctorId },
            data: { whatsappTier: tier },
        });
        this.logger.log(`WhatsApp tier updated to ${tier} for doctor ${doctorId}`);
    }
}
