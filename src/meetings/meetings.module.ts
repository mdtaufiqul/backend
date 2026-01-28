import { Module } from '@nestjs/common';
import { MeetingsService } from './meetings.service';
import { MeetingsController } from './meetings.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CommunicationModule } from '../communication/communication.module';
import { WorkflowModule } from '../workflow/workflow.module';

@Module({
    imports: [PrismaModule, CommunicationModule, WorkflowModule],
    controllers: [MeetingsController],
    providers: [MeetingsService],
    exports: [MeetingsService] // Exporting just in case
})
export class MeetingsModule { }
