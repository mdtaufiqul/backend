export class CreateAppointmentDto {
    patientId?: string;
    doctorId: string;
    clinicId?: string;
    date: string | Date;
    status?: string;
    type?: string;
    notes?: string;
    serviceId?: string;
    guestName?: string;
    guestEmail?: string;
    guestPhone?: string;
    priority?: number;
    waitlistAddedAt?: string | Date;
    waitlistReason?: string;
    recurringFreq?: string;
    recurringUntil?: string | Date;
    recurringGroupId?: string;
}

