import { Module } from '@nestjs/common';
import { SmsIdentityController } from './sms-identity.controller';
import { ServicesModule } from '../services/services.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [ServicesModule, PrismaModule],
    controllers: [SmsIdentityController],
})
export class SmsModule { }
