import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SmsTier } from '@prisma/client';

export interface SmsIdentity {
    from: string;
    tier: SmsTier;
    isAlphanumeric: boolean;
    displayName?: string;
}

@Injectable()
export class SmsSenderService {
    private readonly logger = new Logger(SmsSenderService.name);

    // Countries that support Alphanumeric Sender IDs
    private readonly ALPHANUMERIC_SUPPORTED_COUNTRIES = [
        'GB', // United Kingdom
        'AU', // Australia
        'NZ', // New Zealand
        'SG', // Singapore
        'MY', // Malaysia
        'IN', // India
        'ZA', // South Africa
        'AE', // UAE
        'SA', // Saudi Arabia
        'KW', // Kuwait
        'QA', // Qatar
        'BH', // Bahrain
        'OM', // Oman
        'JO', // Jordan
        'LB', // Lebanon
        'EG', // Egypt
        'PK', // Pakistan
        'BD', // Bangladesh
        'LK', // Sri Lanka
        'PH', // Philippines
        'ID', // Indonesia
        'TH', // Thailand
        'VN', // Vietnam
    ];

    constructor(private prisma: PrismaService) { }

    /**
     * Resolves SMS sender identity based on doctor's tier configuration
     * Tier 1: Personal Number (if verified)
     * Tier 2: Custom Branding (Alphanumeric Sender ID)
     * Tier 3: System Default (Platform's Twilio number)
     */
    async getSmsIdentity(doctorId: string, recipientCountry?: string): Promise<SmsIdentity> {
        const doctor = await this.prisma.user.findUnique({
            where: { id: doctorId },
            select: {
                smsTier: true,
                personalSmsNumber: true,
                smsNumberVerified: true,
                customSenderName: true,
                name: true,
            },
        });

        if (!doctor) {
            this.logger.warn(`Doctor ${doctorId} not found, using system default`);
            return this.getSystemDefault();
        }

        // Tier 1: Personal Number
        if (doctor.smsTier === 'PERSONAL_NUMBER' && doctor.personalSmsNumber && doctor.smsNumberVerified) {
            this.logger.log(`Using personal number for doctor ${doctorId}`);
            return {
                from: doctor.personalSmsNumber,
                tier: SmsTier.PERSONAL_NUMBER,
                isAlphanumeric: false,
                displayName: doctor.name,
            };
        }

        // Tier 2: Custom Branding (Alphanumeric)
        if (doctor.smsTier === 'CUSTOM_BRANDING' && doctor.customSenderName) {
            // Validate alphanumeric ID
            const isValid = this.validateAlphanumericId(doctor.customSenderName);
            if (!isValid) {
                this.logger.warn(`Invalid alphanumeric sender ID for doctor ${doctorId}, falling back to system`);
                return this.getSystemDefault();
            }

            // Check country support
            if (recipientCountry && !this.supportsAlphanumeric(recipientCountry)) {
                this.logger.warn(`Country ${recipientCountry} doesn't support alphanumeric IDs, using system number`);
                return this.getSystemDefault();
            }

            this.logger.log(`Using custom branding "${doctor.customSenderName}" for doctor ${doctorId}`);
            return {
                from: doctor.customSenderName,
                tier: SmsTier.CUSTOM_BRANDING,
                isAlphanumeric: true,
                displayName: doctor.customSenderName,
            };
        }

        // Tier 3: System Default (fallback)
        this.logger.log(`Using system default for doctor ${doctorId}`);
        return this.getSystemDefault();
    }

    /**
     * Validates alphanumeric sender ID
     * Rules:
     * - Max 11 characters
     * - Only letters and numbers
     * - No spaces or special characters
     * - At least one letter (cannot be all numbers)
     */
    validateAlphanumericId(senderId: string): boolean {
        if (!senderId || senderId.length === 0 || senderId.length > 11) {
            return false;
        }

        // Must contain at least one letter
        if (!/[a-zA-Z]/.test(senderId)) {
            return false;
        }

        // Only alphanumeric characters (no spaces or special chars)
        if (!/^[a-zA-Z0-9]+$/.test(senderId)) {
            return false;
        }

        return true;
    }

    /**
     * Checks if a country supports alphanumeric sender IDs
     */
    supportsAlphanumeric(countryCode: string): boolean {
        return this.ALPHANUMERIC_SUPPORTED_COUNTRIES.includes(countryCode.toUpperCase());
    }

    /**
     * Gets the system default Twilio number
     */
    private getSystemDefault(): SmsIdentity {
        const systemNumber = process.env.TWILIO_PHONE_NUMBER;

        if (!systemNumber) {
            throw new Error('TWILIO_PHONE_NUMBER not configured in environment');
        }

        return {
            from: systemNumber,
            tier: SmsTier.SYSTEM_DEFAULT,
            isAlphanumeric: false,
            displayName: 'MediFlow',
        };
    }

    /**
     * Gets list of countries that support alphanumeric sender IDs
     */
    getSupportedCountries(): string[] {
        return [...this.ALPHANUMERIC_SUPPORTED_COUNTRIES];
    }

    /**
     * Sends an SMS using the resolved identity
     */
    async sendSms(to: string, message: string, doctorId: string): Promise<void> {
        // 1. Resolve Identity
        const identity = await this.getSmsIdentity(doctorId);

        // 2. Initialize Twilio Client
        // Note: For now we use the platform's credentials. 
        // In a real multi-tenant setup, we might use Subaccounts or the user's own credentials if provided.
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;

        if (!accountSid || !authToken) {
            this.logger.error('Twilio credentials not configured');
            // Log but don't throw in dev, unless strict
            if (process.env.NODE_ENV === 'production') throw new Error('SMS configuration missing');
            return;
        }

        const client = require('twilio')(accountSid, authToken);

        try {
            await client.messages.create({
                body: message,
                from: identity.from,
                to: to
            });
            this.logger.log(`SMS sent to ${to} from ${identity.from} [Tier: ${identity.tier}]`);
        } catch (error) {
            this.logger.error(`Failed to send SMS to ${to}: ${error.message}`);
            throw error;
        }
    }
}
