
import { Module } from '@nestjs/common';
import { IntakeController } from './intake.controller';
import { IntakeService } from './intake.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ServicesModule } from '../services/services.module';

@Module({
    imports: [PrismaModule, ServicesModule],
    controllers: [IntakeController],
    providers: [IntakeService],
    exports: [IntakeService]
})
export class IntakeModule { }
