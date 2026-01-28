import { Module } from '@nestjs/common';
import { FormsService } from './forms.service';
import { FormsController } from './forms.controller';
import { IntakeController } from './intake.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AppointmentsModule } from '../appointments/appointments.module';
import { WorkflowModule } from '../workflow/workflow.module';

@Module({
  imports: [PrismaModule, AppointmentsModule, WorkflowModule],
  controllers: [FormsController, IntakeController],
  providers: [FormsService],
})
export class FormsModule { }
