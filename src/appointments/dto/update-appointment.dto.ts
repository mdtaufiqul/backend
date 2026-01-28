import { PartialType } from '@nestjs/mapped-types';
import { CreateAppointmentDto } from './create-appointment.dto';

export class UpdateAppointmentDto extends PartialType(CreateAppointmentDto) {
    status?: string;
    notes?: string;
    type?: string;
    date?: string | Date;
    priority?: number;
    waitlistAddedAt?: string | Date;
    waitlistReason?: string;
    rescheduleFuture?: boolean;
}
