import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SmtpController } from './settings/smtp.controller';
import { SmsController } from './settings/sms.controller';
import { CommunicationModule } from './communication/communication.module';
import { EmailTemplatesModule } from './email-templates/email-templates.module';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { ClinicsModule } from './clinics/clinics.module';
import { ServicesModule } from './services/services.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { UsersModule } from './users/users.module';
import { FormsModule } from './forms/forms.module';
import { DashboardModule } from './dashboard/dashboard.module';

import { MessagesModule } from './messages/messages.module';
import { ConversationsModule } from './conversations/conversations.module';
import { WorkflowModule } from './workflow/workflow.module';
import { PatientsModule } from './patients/patients.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';
import { SmsModule } from './sms/sms.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { MeetingsModule } from './meetings/meetings.module';
import { IntakeModule } from './intake/intake.module';
import { MarketingModule } from './marketing/marketing.module';
import { FilesModule } from './files/files.module';
import { AiModule } from './ai/ai.module';
import { EhrModule } from './ehr/ehr.module';

import { BullModule } from '@nestjs/bullmq';

import { LogsController } from './controllers/logs.controller';
import { LogStoreService } from './common/log-store.service';

import { PatientAuthModule } from './auth/patient-auth.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { BillingModule } from './billing/billing.module';
import { ChatWidgetModule } from './chat-widget/chat-widget.module';
import { CommonModule } from './common/common.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
    AuthModule,
    PatientAuthModule, // Added
    ScheduleModule.forRoot(),
    PrismaModule, ClinicsModule, ServicesModule, AppointmentsModule, UsersModule, FormsModule, PatientsModule, MessagesModule, EmailTemplatesModule, ConversationsModule, WorkflowModule, CommunicationModule, WhatsAppModule, SmsModule, WebhooksModule, MeetingsModule, BillingModule,
    ChatWidgetModule,
    IntakeModule,
    MarketingModule,
    FilesModule,
    AiModule,
    EhrModule,
    DashboardModule,
    CommonModule
  ],
  controllers: [AppController, LogsController, SmtpController, SmsController],
  providers: [AppService],
})
export class AppModule { }
