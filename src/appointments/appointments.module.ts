import { Module } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { AppointmentsController } from './appointments.controller';
import { EmailActionsController } from '../controllers/email-actions.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AppointmentsGateway } from './appointments.gateway';
import { DailyService } from '../services/daily.service';
import { ZoomService } from '../services/zoom.service';
import { GoogleMeetService } from '../services/google-meet.service';
import { WorkflowModule } from '../workflow/workflow.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { DynamicMailerService } from '../services/dynamic-mailer.service';
import { EncryptionService } from '../common/encryption.service';
import { EmailTokensService } from '../services/email-tokens.service';
import { WaitlistService } from './waitlist.service';
import { WaitlistController } from './waitlist.controller';
import { ServicesModule } from '../services/services.module';

@Module({
  imports: [PrismaModule, WorkflowModule, ConversationsModule, ServicesModule],
  controllers: [AppointmentsController, EmailActionsController, WaitlistController],
  providers: [
    AppointmentsService,
    WaitlistService,
    AppointmentsGateway,
    DailyService,
    ZoomService,
    GoogleMeetService,
    DynamicMailerService,
    EncryptionService,
    EmailTokensService
  ],
  exports: [AppointmentsService]
})
export class AppointmentsModule { }
