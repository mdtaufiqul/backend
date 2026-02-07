import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WorkflowOrchestrator } from './workflow.orchestrator';
import { WorkflowProcessor } from './workflow.processor';
import { WorkflowScheduler } from './workflow.scheduler';
import { PrismaModule } from '../prisma/prisma.module';
import { CommunicationModule } from '../communication/communication.module';
import { EmailTemplatesModule } from '../email-templates/email-templates.module';
import { ServicesModule } from '../services/services.module';
import { WorkflowController } from './workflow.controller';
import { WorkflowsController } from './workflows.controller';

@Module({
    imports: [
        PrismaModule,
        BullModule.registerQueue({
            name: 'workflow-queue',
        }),
        forwardRef(() => CommunicationModule),
        EmailTemplatesModule,
        ServicesModule, // Provides SmsSenderService and WhatsAppTierService
    ],
    controllers: [WorkflowController, WorkflowsController],
    providers: [WorkflowOrchestrator, WorkflowProcessor, WorkflowScheduler],
    exports: [WorkflowOrchestrator],
})
export class WorkflowModule { }
