import { Injectable, Logger } from '@nestjs/common';
import { LRUCache } from 'lru-cache';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/encryption.service';
import { DoctorSmtpConfig } from '@prisma/client';
import { Resend } from 'resend';

@Injectable()
export class DynamicMailerService {
    private readonly logger = new Logger(DynamicMailerService.name);
    private transporterCache = new LRUCache<string, nodemailer.Transporter>({
        max: 100, // Max 100 transporters in memory
        ttl: 1000 * 60 * 15, // Cache for 15 minutes
        dispose: (transporter) => {
            transporter.close();
        }
    });

    private resend: Resend | null = null;
    constructor(
        private prisma: PrismaService,
        private encryptionService: EncryptionService
    ) {
        if (process.env.RESEND_API_KEY) {
            this.resend = new Resend(process.env.RESEND_API_KEY);
        }
    }

    /**
     * Gets a transporter for a specific doctor
     * Falls back to system Resend if no user config exists
     */
    async getTransporter(userId?: string): Promise<nodemailer.Transporter | null> {
        if (!userId) {
            return this.getSystemResendTransporter();
        }

        // Return from cache if available
        const cached = this.transporterCache.get(userId);
        if (cached) {
            return cached;
        }

        const config = await this.prisma.doctorSmtpConfig.findUnique({
            where: { userId }
        });

        if (!config) {
            this.logger.log(`No SMTP config found for user ${userId}. Using system Resend.`);
            return this.getSystemResendTransporter();
        }

        // Check if user selected system Resend
        if (config.host === 'smtp.resend.com' && config.user === 'resend') {
            this.logger.log(`User ${userId} is using system Resend.`);
            return this.getSystemResendTransporter();
        }

        try {
            const password = this.encryptionService.decrypt(config.passwordEncrypted, config.iv);

            const transporter = nodemailer.createTransport({
                host: config.host,
                port: config.port,
                secure: config.secure,
                auth: {
                    user: config.user,
                    pass: password,
                },
                tls: {
                    ciphers: 'SSLv3',
                    rejectUnauthorized: false
                }
            });

            // Cache the newly created transporter
            this.transporterCache.set(userId, transporter);
            return transporter;
        } catch (error) {
            this.logger.error(`Failed to create transporter for ${userId}: ${error.message}`);
            this.logger.log('Falling back to system Resend');
            return this.getSystemResendTransporter();
        }
    }

    /**
     * Gets system-wide Resend transporter
     */
    private getSystemResendTransporter() {
        const resendApiKey = process.env.RESEND_API_KEY;

        if (!resendApiKey) {
            this.logger.warn('RESEND_API_KEY not configured in environment');
            return null;
        }

        return nodemailer.createTransport({
            host: 'smtp.resend.com',
            port: 465,
            secure: true,
            auth: {
                user: 'resend',
                pass: resendApiKey,
            },
        });
    }

    /**
     * Verifies the SMTP connection
     */
    async verifyConnection(userId: string): Promise<{ success: boolean; message?: string }> {
        const transporter = await this.getTransporter(userId);
        if (!transporter) {
            return { success: false, message: 'Configuration not found or invalid' };
        }

        try {
            await transporter.verify();
            return { success: true };
        } catch (error) {
            this.logger.error(`SMTP Verification Failed for ${userId}: ${error.message}`);
            return { success: false, message: error.message };
        }
    }

    /**
     * Sends an email
     */
    async sendMail(userId: string | undefined, options: nodemailer.SendMailOptions) {
        const transporter = await this.getTransporter(userId);
        let config: DoctorSmtpConfig | null = null;

        if (userId) {
            config = await this.prisma.doctorSmtpConfig.findUnique({ where: { userId } });
        }

        if (!transporter) {
            throw new Error("SMTP Configuration missing");
        }

        // Determine if using system Resend
        // If no userId, force system resend.
        const isSystemResend = !userId || !config || (config.host === 'smtp.resend.com' && config.user === 'resend');

        let fromName: string;
        let fromAddress: string;

        if (isSystemResend) {
            // For system Resend, generate doctor-specific email or use system default
            const doctor = userId ? await this.prisma.user.findUnique({
                where: { id: userId },
                include: { clinic: true }
            }) : null;
            const resendDomain = process.env.RESEND_DOMAIN || 'webestation.com';
            const businessName = process.env.BUSINESS_NAME || 'MediFlow';

            if (doctor) {
                // Generate email from doctor's name (e.g., "taufiq" from "Taufiq Rahman")
                const firstName = doctor.name.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '');

                // Use logic: If user has a clinic, send FROM the Clinic Name. Otherwise User Name.
                fromName = doctor.clinic?.name || doctor.name;

                // Should we force business domain? YES.
                fromAddress = `${firstName}@${resendDomain}`;
            } else {
                // System notifications (fallback)
                fromName = businessName;
                const senderLocalPart = businessName.toLowerCase().replace(/[^a-z0-9]/g, '');
                fromAddress = `${senderLocalPart}@${resendDomain}`;
            }
        } else {
            // Use configured SMTP settings
            fromName = config?.senderName || config?.user || 'MediFlow';
            fromAddress = config?.user || 'noreply@example.com';
        }


        if (isSystemResend) {
            if (!this.resend) {
                this.logger.error('Resend SDK not initialized. Cannot send system email.');
                throw new Error('System email service unavailable');
            }

            try {
                this.logger.log(`Sending system email via Resend SDK to ${options.to}`);
                return await this.resend.emails.send({
                    from: `"${fromName}" <${fromAddress}>`,
                    to: options.to as string,
                    subject: options.subject as string,
                    html: options.html as string,
                });
            } catch (error) {
                this.logger.error(`Resend SDK sending failed: ${error.message}`);
                throw error;
            }
        }

        return (transporter as nodemailer.Transporter).sendMail({
            ...options,
            from: `"${fromName}" <${fromAddress}>`
        });
    }
}
