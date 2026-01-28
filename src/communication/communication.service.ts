
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TwilioService } from '../services/twilio.service';
import { WhatsAppTierService } from '../services/whatsapp-tier.service';
import { DynamicMailerService } from '../services/dynamic-mailer.service';
import { SmsSenderService } from '../services/sms-sender.service';
import { PatientScoreService } from '../patients/patient-score.service';

@Injectable()
export class CommunicationService {
    private readonly logger = new Logger(CommunicationService.name);

    constructor(
        private prisma: PrismaService,
        private twilioService: TwilioService,
        private whatsappTierService: WhatsAppTierService,
        private mailerService: DynamicMailerService,
        private smsSenderService: SmsSenderService,
        private patientScoreService: PatientScoreService,
    ) { }

    /**
     * Logs an inbound message to CommunicationLog
     */
    async logInboundInteraction(data: {
        patientId: string;
        type: 'SMS' | 'WHATSAPP' | 'EMAIL';
        content: string;
        fromIdentity: string;
        metadata?: any;
    }) {
        try {
            const log = await this.prisma.communicationLog.create({
                data: {
                    patientId: data.patientId,
                    type: data.type,
                    direction: 'INBOUND',
                    status: 'RECEIVED',
                    content: data.content,
                    fromIdentity: data.fromIdentity,
                    sentAt: new Date(),
                    // We can try to link to latest appointment if needed, but for now generic log
                }
            });
            this.logger.log(`Logged inbound ${data.type} from Patient ${data.patientId}`);

            // Trigger Score Update
            await this.patientScoreService.handlePatientReply(data.patientId);

            return log;
        } catch (error) {
            this.logger.error(`Failed to log inbound interaction: ${error.message}`);
            // Don't throw, we don't want to crash the webhook response
        }
    }

    /**
     * Fetches unified history for a patient
     */
    async getPatientHistory(patientId: string) {
        return this.prisma.communicationLog.findMany({
            where: { patientId },
            orderBy: { sentAt: 'asc' },
            include: {
                workflow: { select: { name: true } },
                appointment: { select: { date: true, type: true } }
            }
        });
    }

    /**
     * Sends a manual message from the Unified Chat
     */
    async sendManualMessage(
        doctorId: string,
        patientId: string,
        type: 'SMS' | 'WHATSAPP' | 'EMAIL' | 'IN_APP',
        content: string
    ) {
        const patient = await this.prisma.patient.findUnique({ where: { id: patientId } });
        if (!patient) throw new Error('Patient not found');

        let status = 'SENT';
        let errorMsg = null;
        let fromIdentity = 'System';
        let tierUsed: string | null = null;

        try {
            if (type === 'SMS') {
                if (!patient.phone) throw new Error('Patient has no phone number');
                const identity = await this.smsSenderService.getSmsIdentity(doctorId);
                await this.twilioService.sendSms(identity.from, patient.phone, content, doctorId);
                fromIdentity = identity.from;
                tierUsed = identity.tier;
            }
            else if (type === 'WHATSAPP') {
                if (!patient.phone) throw new Error('Patient has no phone number');
                await this.whatsappTierService.sendWhatsApp(doctorId, patient.phone, content);
                fromIdentity = 'WhatsApp'; // TODO: Get actual sender from tier service
                tierUsed = 'TIER_SERVICE';
            }

            else if (type === 'EMAIL') {
                if (!patient.email) throw new Error('Patient has no email');
                await this.mailerService.sendMail(doctorId, {
                    to: patient.email,
                    subject: 'Message from your Doctor', // Could be dynamic
                    html: `<p>${content}</p>` // Simple text for manual chat
                });
                fromIdentity = 'Email';
            }
            else if (type === 'IN_APP') {
                // Internal message only - no external provider
                // Just saving to DB is enough (handled in finally block)
                fromIdentity = 'Doctor';
                status = 'SENT';
            }
        } catch (e) {
            this.logger.error(`Failed to send manual ${type}: ${e.message}`);
            status = 'FAILED';
            errorMsg = e.message;
            throw e; // Rethrow so controller knows it failed
        } finally {
            // Log the attempt
            await this.prisma.communicationLog.create({
                data: {
                    patientId,
                    type,
                    direction: 'OUTBOUND',
                    status,
                    content: errorMsg ? `Failed: ${errorMsg}` : content,
                    fromIdentity,
                    tierUsed,
                    providerId: 'manual',
                }
            });
        }
    }
}
