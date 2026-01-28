import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class ResendService {
    private readonly logger = new Logger(ResendService.name);
    private resend: Resend | null = null;

    constructor() {
        const apiKey = process.env.RESEND_API_KEY;
        if (apiKey) {
            this.resend = new Resend(apiKey);
            this.logger.log('✅ Resend email service initialized');
        } else {
            this.logger.warn('⚠️  RESEND_API_KEY not found - Resend service disabled');
        }
    }

    /**
     * Check if Resend is configured
     */
    isConfigured(): boolean {
        return this.resend !== null;
    }

    /**
     * Send email via Resend
     */
    async sendEmail(options: {
        to: string | string[];
        from?: string;
        subject: string;
        html: string;
        replyTo?: string;
    }) {
        if (!this.resend) {
            throw new Error('Resend is not configured. Please set RESEND_API_KEY in .env');
        }

        try {
            // Default from address (must be verified in Resend)
            const fromAddress = options.from || process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

            const result = await this.resend.emails.send({
                from: fromAddress,
                to: Array.isArray(options.to) ? options.to : [options.to],
                subject: options.subject,
                html: options.html,
                ...(options.replyTo && { reply_to: options.replyTo })
            });

            this.logger.log(`📧 Email sent via Resend to ${options.to}`);
            return result;
        } catch (error) {
            this.logger.error(`❌ Failed to send email via Resend: ${error.message}`);
            throw error;
        }
    }

    /**
     * Send email with template
     */
    async sendTemplateEmail(options: {
        to: string | string[];
        from?: string;
        subject: string;
        template: string;
        variables: Record<string, any>;
        replyTo?: string;
    }) {
        // Simple variable replacement
        let html = options.template;
        for (const [key, value] of Object.entries(options.variables)) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            html = html.replace(regex, String(value));
        }

        return this.sendEmail({
            to: options.to,
            from: options.from,
            subject: options.subject,
            html,
            replyTo: options.replyTo
        });
    }
}
