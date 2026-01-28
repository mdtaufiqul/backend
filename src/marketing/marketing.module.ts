
import { Module } from '@nestjs/common';
import { RecallController } from './recall/recall.controller';
import { RecallService } from './recall/recall.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ServicesModule } from '../services/services.module';

@Module({
    imports: [PrismaModule, ServicesModule],
    controllers: [RecallController],
    providers: [RecallService],
    exports: [RecallService]
})
export class MarketingModule { }
