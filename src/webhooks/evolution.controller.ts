import { Controller, Post, Body, Headers, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { Public } from '../common/public.decorator';
import { CommunicationService } from '../communication/communication.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('webhooks/evolution')
export class EvolutionWebhookController {
    private readonly logger = new Logger(EvolutionWebhookController.name);

    constructor(
        private communicationService: CommunicationService,
        private prisma: PrismaService,
    ) { }

    @Public()
    @Post()
    async handleIncomingMessage(@Body() payload: any, @Headers('apikey') apiKey: string) {
        // Optional: specific key validation if we set one in webhook config, 
        // but Evolution API usually sends its global API key or specific webhook header if configured.
        // For local dev, we might skip strict check or check against EVOLUTION_API_KEY if Evolution sends it back (it usually doesn't send the API key in webhook headers unless customized).

        // Log event
        if (payload.event === 'messages.upsert') {
            const message = payload.data?.message;
            if (message) {
                // Extract text
                const text = message.conversation || message.extendedTextMessage?.text || '';
                let from = payload.data?.key?.remoteJid; // e.g. 1234567890@s.whatsapp.net
                const pushName = payload.data?.pushName || 'Unknown';

                this.logger.log(`[Interaction] 📩 New Message from ${pushName} (${from}): "${text}"`);

                if (from) {
                    // Cleanup JID to get phone number
                    from = from.split('@')[0];

                    const patient = await this.prisma.patient.findFirst({
                        where: {
                            OR: [
                                { phone: from },
                                { phone: `+${from}` },
                                { phone: from.replace('+', '') } // Logic is tricky without consistent formatting
                            ]
                        }
                    });

                    if (patient) {
                        await this.communicationService.logInboundInteraction({
                            patientId: patient.id,
                            type: 'WHATSAPP',
                            content: text,
                            fromIdentity: from,
                            metadata: payload
                        });
                    } else {
                        this.logger.warn(`Received WhatsApp from unknown number: ${from}`);
                    }
                }
            }
        } else {
            this.logger.debug(`[Evolution Webhook] Received event: ${payload.event}`);
        }

        return { status: 'success' };
    }
}
