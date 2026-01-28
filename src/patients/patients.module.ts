
import { Module } from '@nestjs/common';
import { PatientsService } from './patients.service';
import { PatientScoreService } from './patient-score.service';
import { PatientsController } from './patients.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [PatientsController],
    providers: [PatientsService, PatientScoreService],
    exports: [PatientsService, PatientScoreService],
})
export class PatientsModule { }

