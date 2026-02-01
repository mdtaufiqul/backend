
import { Injectable, Logger, Inject, forwardRef, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TwilioService } from '../services/twilio.service';
import { WhatsAppTierService } from '../services/whatsapp-tier.service';
import { DynamicMailerService } from '../services/dynamic-mailer.service';
import { SmsSenderService } from '../services/sms-sender.service';
import { PatientScoreService } from '../patients/patient-score.service';
import { ConversationsService } from '../conversations/conversations.service';

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
        @Inject(forwardRef(() => ConversationsService))
        private conversationsService: ConversationsService,
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
        content: string,
        senderContext?: any
    ) {
        const patient = await this.prisma.patient.findUnique({ where: { id: patientId } });
        if (!patient) throw new Error('Patient not found');

        const role = senderContext?.role?.toLowerCase();
        const isPatient = role === 'patient';
        
        // Resolve target doctor if "unknown"
        let effectiveDoctorId = doctorId;
        if (doctorId === 'unknown' || !doctorId) {
            const fallbackDoc = await this.prisma.user.findFirst({
                where: { clinicId: patient.clinicId, role: 'doctor' }
            });
            if (!fallbackDoc) {
                throw new HttpException('No doctor assigned to this patient and no clinic doctor found to receive message.', HttpStatus.BAD_REQUEST);
            }
            effectiveDoctorId = fallbackDoc.id;
        }

        let status = 'SENT';
        let errorMsg = null;
        let fromIdentity = isPatient ? 'Patient' : 'Doctor';
        let direction: 'INBOUND' | 'OUTBOUND' = isPatient ? 'INBOUND' : 'OUTBOUND';
        let tierUsed: string | null = null;

        try {
            if (isPatient) {
                // Patient -> Doctor direction
                if (type === 'EMAIL') {
                    const doctor = await this.prisma.user.findUnique({ where: { id: effectiveDoctorId } });
                    if (!doctor || !doctor.email) throw new Error('Doctor email not available');
                    
                    await this.mailerService.sendMail(undefined, { 
                        to: doctor.email,
                        subject: `New Message from Patient: ${patient.name}`,
                        html: `
                            <div style="font-family: sans-serif;">
                                <p>You have received a new email message via the patient portal:</p>
                                <blockquote style="border-left: 4px solid #eee; padding-left: 10px; margin: 20px 0;">
                                    ${content}
                                </blockquote>
                                <p><strong>From:</strong> ${patient.name} (${patient.email || 'No email'})</p>
                            </div>
                        `
                    });
                    fromIdentity = patient.email || 'Patient Email';
                    status = 'RECEIVED';
                } else if (type === 'IN_APP') {
                    // Resolve conversation
                    const conversation = await this.conversationsService.getOrCreateConversation(effectiveDoctorId, patientId);
                    await this.conversationsService.sendMessage(
                        conversation.id,
                        content,
                        senderContext?.userId || patientId,
                        'patient',
                        patient.clinicId || undefined,
                        patientId
                    );
                    status = 'RECEIVED';
                } else {
                    throw new Error(`Patients cannot send ${type} directly. Use Internal Chat.`);
                }
            } else {
                // Doctor -> Patient direction
                if (type === 'SMS') {
                    if (!patient.phone) throw new Error('Patient has no phone number');
                    const identity = await this.smsSenderService.getSmsIdentity(effectiveDoctorId);
                    await this.twilioService.sendSms(identity.from, patient.phone, content, effectiveDoctorId);
                    fromIdentity = identity.from;
                    tierUsed = identity.tier;
                }
                else if (type === 'WHATSAPP') {
                    if (!patient.phone) throw new Error('Patient has no phone number');
                    await this.whatsappTierService.sendWhatsApp(effectiveDoctorId, patient.phone, content);
                    fromIdentity = 'WhatsApp';
                    tierUsed = 'TIER_SERVICE';
                }
                else if (type === 'EMAIL') {
                    if (!patient.email) throw new Error('Patient has no email');
                    await this.mailerService.sendMail(effectiveDoctorId, {
                        to: patient.email,
                        subject: 'Message from your Doctor',
                        html: `<p>${content}</p>`
                    });
                    fromIdentity = 'Email';
                }
                else if (type === 'IN_APP') {
                    const conversation = await this.conversationsService.getOrCreateConversation(effectiveDoctorId, patientId);
                    await this.conversationsService.sendMessage(
                        conversation.id,
                        content,
                        effectiveDoctorId,
                        role,
                        patient.clinicId || undefined
                    );
                    status = 'SENT';
                }
            }
        } catch (e) {
            this.logger.error(`Failed to send manual ${type}: ${e.message}`);
            status = 'FAILED';
            errorMsg = e.message;
            throw e;
        } finally {
            // Log the attempt
            await this.prisma.communicationLog.create({
                data: {
                    patientId,
                    type,
                    direction,
                    status,
                    content: errorMsg ? `Failed: ${errorMsg}` : content,
                    fromIdentity,
                    tierUsed,
                    providerId: 'manual',
                }
            });
            
            if (isPatient && status === 'RECEIVED') {
                 await this.patientScoreService.handlePatientReply(patientId);
            }
        }
    }
}
