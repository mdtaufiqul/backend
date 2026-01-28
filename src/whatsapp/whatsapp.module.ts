import { Module } from '@nestjs/common';
import { WhatsAppController } from './whatsapp.controller';
import { ServicesModule } from '../services/services.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [ServicesModule, PrismaModule],
    controllers: [WhatsAppController],
})
export class WhatsAppModule { }
