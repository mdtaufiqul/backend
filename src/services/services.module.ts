import { Module } from '@nestjs/common';
import { DailyService } from './daily.service';
import { ZoomService } from './zoom.service';
import { GoogleMeetService } from './google-meet.service';
import { TwilioService } from './twilio.service';
import { DynamicMailerService } from './dynamic-mailer.service';
import { SmsSenderService } from './sms-sender.service';
import { WhatsAppTierService } from './whatsapp-tier.service';
import { AiService } from './ai.service';
import { EmailTokensService } from './email-tokens.service';
import { ServicesController } from './services.controller';

import { ServicesService } from './services.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EncryptionService } from '../common/encryption.service';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [PrismaModule, AiModule],
  controllers: [ServicesController],
  providers: [
    ServicesService,
    DailyService,
    ZoomService,
    GoogleMeetService,
    TwilioService,
    DynamicMailerService,
    SmsSenderService,
    WhatsAppTierService,
    EncryptionService,
    EmailTokensService
  ],
  exports: [
    ServicesService,
    DailyService,
    ZoomService,
    GoogleMeetService,
    TwilioService,
    DynamicMailerService,
    SmsSenderService,
    WhatsAppTierService,
    EncryptionService,
    EmailTokensService,
    AiModule
  ]
})
export class ServicesModule { }
