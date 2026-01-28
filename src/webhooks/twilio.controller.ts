import { Controller, Post, Body, Logger, Headers, Request } from '@nestjs/common';
import { CommunicationService } from '../communication/communication.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConversationsService } from '../conversations/conversations.service';

@Controller('webhooks/twilio')
export class TwilioWebhookController {
    private readonly logger = new Logger(TwilioWebhookController.name);

    constructor(
        private communicationService: CommunicationService,
        private conversationsService: ConversationsService,
        private prisma: PrismaService,
    ) { }

    /**
     * REQUEST URL: Inbound Messages
     * POST /api/webhooks/twilio/inbound
     */
    @Post('inbound')
    async handleInbound(@Body() body: any) {
        // body contains From, To, Body, etc.
        const from = body.From; // e.g., +1234567890
        const text = body.Body;

        this.logger.log(`Received inbound message: From=${from}, Body="${text}"`);

        // 1. Find Patient
        // Twilio sends number as +E.164. Our DB might store it differently, but usually we try to keep E.164.
        // We'll clean it up to be safe (remove + if needed, or match fuzzy).
        // For now, assume strict match or substring match.
        // Prisma `contains` might be safer if formatting varies.
        const patient = await this.prisma.patient.findFirst({
            where: {
                OR: [
                    { phone: from },
                    { phone: from.replace('+', '') }
                ]
            }
        });

        if (patient) {
            // Log to Audit
            await this.communicationService.logInboundInteraction({
                patientId: patient.id,
                type: 'SMS',
                content: text,
                fromIdentity: from,
                metadata: body
            });

            // Inject into Chat
            await this.conversationsService.handleInboundMessage(patient.id, text, body);

        } else {
            this.logger.warn(`Received SMS from unknown number: ${from}`);
        }

        // Return empty TwiML to satisfy Twilio (avoids error on their end)
        return `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
    }

    /**
     * FALLBACK URL: Error Handling
     * POST /api/webhooks/twilio/fallback
     */
    @Post('fallback')
    async handleFallback(@Body() body: any) {
        this.logger.error(`Twilio Fallback Error: ErrorCode=${body.ErrorCode}, Url=${body.ErrorUrl}`);
        this.logger.debug(JSON.stringify(body));
        return 'OK';
    }

    /**
     * STATUS CALLBACK URL: Delivery Updates
     * POST /api/webhooks/twilio/callback
     */
    @Post('callback')
    async handleStatusCallback(@Body() body: any) {
        this.logger.log(`Message Status: Sid=${body.MessageSid}, Status=${body.MessageStatus}`);
        return 'OK';
    }
}
