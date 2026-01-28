import { Module } from '@nestjs/common';
import { EhrController } from './ehr.controller';
import { EhrService } from './ehr.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [EhrController],
    providers: [EhrService],
    exports: [EhrService]
})
export class EhrModule { }
