import { Module } from '@nestjs/common';
import { TwilioWebhookController } from './twilio.controller';
import { EvolutionWebhookController } from './evolution.controller';
import { CommunicationModule } from '../communication/communication.module';
import { PrismaModule } from '../prisma/prisma.module';

import { ResendWebhooksController } from '../controllers/resend-webhooks.controller';
import { ConversationsModule } from '../conversations/conversations.module';
import { WorkflowModule } from '../workflow/workflow.module';

@Module({
    imports: [CommunicationModule, PrismaModule, WorkflowModule, ConversationsModule],
    controllers: [TwilioWebhookController, EvolutionWebhookController, ResendWebhooksController],
    providers: [],
})
export class WebhooksModule { }
