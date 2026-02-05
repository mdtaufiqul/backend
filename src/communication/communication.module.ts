import { Module } from '@nestjs/common';
import { EncryptionService } from '../common/encryption.service';
import { DynamicMailerService } from '../services/dynamic-mailer.service';
import { PrismaModule } from '../prisma/prisma.module';

import { TwilioService } from '../services/twilio.service';
import { CommunicationService } from './communication.service';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { SmsModule } from '../sms/sms.module';
import { SmsSenderService } from '../services/sms-sender.service';
import { WhatsAppTierService } from '../services/whatsapp-tier.service';
import { CommunicationController } from './communication.controller';
import { PatientsModule } from '../patients/patients.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { forwardRef } from '@nestjs/common';

@Module({
    imports: [PrismaModule, WhatsAppModule, SmsModule, PatientsModule, forwardRef(() => ConversationsModule)],
    controllers: [CommunicationController],
    providers: [EncryptionService, DynamicMailerService, TwilioService, CommunicationService, SmsSenderService, WhatsAppTierService],
    exports: [EncryptionService, DynamicMailerService, TwilioService, CommunicationService, SmsSenderService, WhatsAppTierService],
})
export class CommunicationModule { }
