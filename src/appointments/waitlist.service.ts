
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DynamicMailerService } from '../services/dynamic-mailer.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class WaitlistService {
    private readonly logger = new Logger(WaitlistService.name);
    private readonly FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

    constructor(
        private prisma: PrismaService,
        private mailerService: DynamicMailerService
    ) { }

    /**
     * Process a cancelled appointment to find waitlist candidates
     */
    async processCancellation(appointmentId: string) {
        this.logger.log(`Processing cancellation for appointment ${appointmentId}`);

        const appointment = await this.prisma.appointment.findUnique({
            where: { id: appointmentId },
            include: { service: true, clinic: true, doctor: true }
        });

        if (!appointment) return;

        // 1. Honor Automatic vs Manual Setting
        // If automaticWaitlist is false, we don't auto-process cancellations for this doctor
        if (!appointment.doctor.automaticWaitlist) {
            this.logger.log(`Automatic waitlist is DISABLED for doctor ${appointment.doctorId}. Skipping auto-processing.`);
            return;
        }

        // 2. Find Waitlist Candidates (Top 3)
        // Criteria: Same doctor, Same status='waitlist', Same Slot Type (Online vs In-Person)
        const candidates = await this.prisma.appointment.findMany({
            where: {
                doctorId: appointment.doctorId,
                status: 'waitlist',
                type: appointment.type // Honor Online/In-person separately
            },
            include: { patient: true },
            orderBy: [
                { priority: 'asc' }, // Lower number = higher priority
                { waitlistAddedAt: 'asc' }
            ],
            take: 3
        });

        if (candidates.length === 0) {
            this.logger.log('No waitlist candidates found.');
            return;
        }

        this.logger.log(`Found ${candidates.length} candidates. Sending offers...`);

        // 3. Create Offers & Send Notifications
        for (const candidate of candidates) {
            await this.sendOfferToPatient(candidate.patientId!, appointmentId, appointment.doctorId, appointment.date);
        }
    }

    /**
     * Create a manual offer for a specific patient and slot
     */
    async createManualOffer(patientId: string, appointmentId?: string, doctorId?: string, date?: Date) {
        this.logger.log(`Creating manual offer for patient ${patientId}`);

        let finalAppointmentId = appointmentId;

        if (!finalAppointmentId) {
            if (!doctorId || !date) throw new BadRequestException('appointmentId or doctorId+date is required');

            // Create PLACEHOLDER appointment (status: cancelled so it's "available" for claiming)
            const placeholder = await this.prisma.appointment.create({
                data: {
                    doctorId,
                    date: new Date(date),
                    status: 'cancelled',
                    notes: 'Manual Waitlist Offer Slot',
                    type: 'video' // Default
                }
            });
            finalAppointmentId = placeholder.id;
        }

        const appointment = await this.prisma.appointment.findUnique({
            where: { id: finalAppointmentId }
        });

        if (!appointment) throw new NotFoundException('Slot not found');

        return await this.sendOfferToPatient(patientId, finalAppointmentId, appointment.doctorId, appointment.date);
    }

    /**
     * Internal helper to generate token, create record, and send notification via EMAIL
     */
    private async sendOfferToPatient(patientId: string, appointmentId: string, doctorId: string, slotDate: Date) {
        try {
            const patient = await this.prisma.patient.findUnique({ where: { id: patientId } });
            if (!patient || !patient.email) {
                this.logger.warn(`Skip sending offer: Patient ${patientId} has no email.`);
                return null;
            }

            // Generate Unique Token
            const token = uuidv4();
            const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 Hour Expiry

            // Create Offer Record
            const offer = await this.prisma.waitlistOffer.create({
                data: {
                    appointmentId: appointmentId,
                    patientId: patientId,
                    token: token,
                    expiresAt: expiresAt,
                    status: 'PENDING'
                }
            });

            // Generate Magic Link
            const claimLink = `${this.FRONTEND_URL}/claim-slot?token=${token}`;

            // Format Message
            const dateStr = new Date(slotDate).toLocaleDateString();
            const timeStr = new Date(slotDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            const doctorName = await this.getDoctorName(doctorId);
            const subject = `MediFlow Alert: Appointment slot available with Dr. ${doctorName}`;
            const html = `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Appointment Slot Available!</h2>
                    <p>Hello ${patient.name},</p>
                    <p>An appointment slot has just become available with <strong>Dr. ${doctorName}</strong> on <strong>${dateStr} at ${timeStr}</strong>.</p>
                    <p>This is offered on a first-come, first-served basis. If you would like to claim this slot, please click the button below:</p>
                    <a href="${claimLink}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 16px 0;">Claim This Slot</a>
                    <p>This link will expire in 1 hour.</p>
                    <p>Best regards,<br>The MediFlow Team</p>
                </div>
            `;

            // Send via Email
            await this.mailerService.sendMail(doctorId, {
                to: patient.email,
                subject,
                html
            });

            this.logger.log(`✅ Waitlist offer email sent to ${patient.email}`);

            return offer;
        } catch (err) {
            this.logger.error(`Failed to send offer to patient ${patientId}: ${err.message}`);
            throw err;
        }
    }

    private async getDoctorName(id: string) {
        const doc = await this.prisma.user.findUnique({ where: { id }, select: { name: true } });
        return doc?.name || 'Unknown';
    }

    /**
     * Claim a slot using a token
     */
    async claimSlot(token: string) {
        // 1. Validate Token
        const offer = await this.prisma.waitlistOffer.findUnique({
            where: { token },
            include: { appointment: true, patient: true }
        });

        if (!offer) {
            throw new NotFoundException('Invalid offer token');
        }

        if (offer.status !== 'PENDING') {
            throw new BadRequestException('This offer is no longer valid (already claimed or expired)');
        }

        if (offer.expiresAt < new Date()) {
            await this.prisma.waitlistOffer.update({ where: { id: offer.id }, data: { status: 'EXPIRED' } });
            throw new BadRequestException('This offer has expired');
        }

        // 2. Check if Slot is still available (status CANCELLED means it's free to take)
        // Wait, if it's CANCELLED, we re-book it?
        // OR do we create a NEW appointment?
        // Logic: The original appointment ID is the one that was cancelled.
        // We should UPDATE that appointment to be "scheduled" and assign new patient.

        const appointment = await this.prisma.appointment.findUnique({ where: { id: offer.appointmentId } });

        if (appointment?.status === 'scheduled') {
            // Race condition: Someone else took it
            await this.prisma.waitlistOffer.update({ where: { id: offer.id }, data: { status: 'SUPERSEDED' } });
            throw new BadRequestException('Sorry, this slot has already been taken.');
        }

        // 3. BOOK IT
        await this.prisma.$transaction(async (tx) => {
            // A. Update Appointment
            await tx.appointment.update({
                where: { id: offer.appointmentId },
                data: {
                    status: 'scheduled',
                    patientId: offer.patientId,
                    date: appointment!.date, // Keep date
                    isConfirmed: true,       // Auto-confirm
                    notes: `Claimed via Waitlist by ${offer.patient.name}`
                }
            });

            // B. Close this offer
            await tx.waitlistOffer.update({
                where: { id: offer.id },
                data: { status: 'ACCEPTED' }
            });

            // C. Expire other offers for this appointment
            await tx.waitlistOffer.updateMany({
                where: {
                    appointmentId: offer.appointmentId,
                    status: 'PENDING',
                    id: { not: offer.id }
                },
                data: { status: 'SUPERSEDED' }
            });

            // D. Remove Patient from their OLD waitlist entry?
            // They might have a separate "waitlist" appointment entry.
            // We should find their waitlist entry and mark it as 'resolved' or delete it.
            // For now, let's just leave it or mark their waitlist appointment as cancelled?
            // "Waitlist" is an appointment status. We should find THEIR waitlist appointment and Cancel it.
            await tx.appointment.updateMany({
                where: {
                    patientId: offer.patientId,
                    doctorId: appointment!.doctorId,
                    status: 'waitlist'
                },
                data: { status: 'cancelled', notes: 'Auto-cancelled: Claimed slot via Smart Waitlist' }
            });
        });

        // 4. Notify Confirmation
        // (Optional: Trigger 'APPOINTMENT_CONFIRMED' workflow via Orchestrator if integrated)

        return {
            success: true,
            message: 'Appointment confirmed successfully!',
            details: {
                date: appointment?.date,
                doctor: appointment?.doctorId // Should map to name
            }
        };
    }
}
