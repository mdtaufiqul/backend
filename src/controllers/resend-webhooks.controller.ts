import { Controller, Post, Body, Headers, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WorkflowOrchestrator } from '../workflow/workflow.orchestrator';

@Controller('webhooks/resend')
export class ResendWebhooksController {
    private readonly logger = new Logger(ResendWebhooksController.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly orchestrator: WorkflowOrchestrator
    ) { }

    @Post()
    async handleWebhook(@Body() body: any, @Headers('resend-signature') signature: string) {
        const { type, data } = body;
        this.logger.log(`Received Resend Webhook: ${type}`);

        if (!data || !data.email_id) return { success: true };

        // Attempt to find the patient associated with this email
        // We look up CommunicationLog where metadata->messageId == data.email_id
        // (Assuming we save it correctly, if not, this will just not match, which is fine for MVP)
        const log = await this.prisma.communicationLog.findFirst({
            where: {
                metadata: {
                    path: ['messageId'],
                    equals: data.email_id
                }
            }
        });

        if (log && log.patientId) {
            let eventType = '';
            if (type === 'email.opened') eventType = 'EMAIL_OPENED';
            if (type === 'email.clicked') eventType = 'EMAIL_CLICKED';

            if (eventType) {
                this.logger.log(`Triggering ${eventType} workflow for Patient ${log.patientId}`);
                await this.orchestrator.triggerEvent(eventType, {
                    patientId: log.patientId,
                    emailId: data.email_id,
                    metadata: data
                });
            }
        } else {
            // Debug log
            // this.logger.debug(`Could not link email_id ${data.email_id} to a patient.`);
        }

        return { success: true };
    }
}
