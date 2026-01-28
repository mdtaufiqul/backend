
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { AiService } from '../../services/ai.service';
import { SmsSenderService } from '../../services/sms-sender.service';

@Injectable()
export class RecallService {
    private readonly logger = new Logger(RecallService.name);

    constructor(
        private prisma: PrismaService,
        private aiService: AiService,
        private smsService: SmsSenderService
    ) { }

    /**
     * Scans for patients who haven't visited in 6 months and have no future appointments.
     */
    async scanForOpportunities() {
        this.logger.log('Scanning for recall opportunities...');
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        // 1. Find candidates
        // Note: In a real large DB, we'd use raw SQL or optimized queries. 
        // For now, we fetch candidate patients and filter in JS or simple Prisma queries.
        // To be efficient: Find patients with LAST appointment < 6 months ago AND status != cancelled
        // This requires complex aggregation/grouping in Prisma or multiple queries.
        // Let's iterate slightly less efficiently for MVP:
        // Find all active patients, check their last appointment.

        // Better Approach:
        // Find appointments < 6 months ago. Exclude those patients. 
        // Start with all patients. Exclude those with appointments > 6 months ago or Future.

        const patients = await this.prisma.patient.findMany({
            where: {
                // Optimally we'd filter here, but let's grab active patients
                // AND ensure they don't have an open recall opportunity already
                recallOpportunities: {
                    none: { status: { in: ['PENDING', 'SENT'] } }
                }
            },
            include: {
                appointments: {
                    orderBy: { date: 'desc' },
                    take: 1
                }
            }
        });

        let count = 0;

        for (const patient of patients) {
            const lastAppt = patient.appointments[0];

            // If no appt ever, maybe ignore? Or new patient recall? Assume ignore for now.
            if (!lastAppt) continue;

            const lastDate = new Date(lastAppt.date);
            const hasFuture = lastDate > new Date(); // If last appt is in future
            const isRecent = lastDate > sixMonthsAgo;

            if (hasFuture || isRecent) continue;

            // Create Opportunity
            await this.prisma.recallOpportunity.create({
                data: {
                    patientId: patient.id,
                    reason: '6 Month Checkup',
                    status: 'PENDING',
                    draftMessage: await this.generateDraft(patient.name, lastAppt.type)
                }
            });
            count++;
        }

        this.logger.log(`Generated ${count} recall opportunities.`);
        return { generated: count };
    }

    private async generateDraft(patientName: string, lastType: string): Promise<string> {
        try {
            return await this.aiService.generateNotes(
                `Patient Name: ${patientName}, Last Visit Type: ${lastType}`,
                "Draft a friendly and professional healthcare recall SMS (max 160 chars). Encourage the patient to book a follow-up as it's been 6 months. End with 'Reply BOOK to schedule'."
            );
        } catch (error) {
            return `Hi ${patientName.split(' ')[0]}, it's been over 6 months since your last ${lastType} visit. We recommend scheduling a checkup. Reply BOOK to schedule.`;
        }
    }

    async getOpportunities() {
        return this.prisma.recallOpportunity.findMany({
            where: { status: 'PENDING' },
            include: { patient: true },
            orderBy: { createdAt: 'desc' }
        });
    }

    async sendRecall(opportunityId: string) {
        const opp = await this.prisma.recallOpportunity.findUnique({
            where: { id: opportunityId },
            include: {
                patient: {
                    include: {
                        appointments: {
                            orderBy: { date: 'desc' },
                            take: 1
                        }
                    }
                }
            }
        });

        if (!opp || !opp.draftMessage) throw new Error("Invalid opportunity");

        const lastDoctorId = opp.patient.appointments[0]?.doctorId;

        // Send SMS
        if (opp.patient.phone && lastDoctorId) {
            try {
                await this.smsService.sendSms(opp.patient.phone, opp.draftMessage, lastDoctorId);
                this.logger.log(`Recall SMS sent to ${opp.patient.phone} for patient ${opp.patient.name}`);
            } catch (error) {
                this.logger.error(`Failed to send recall SMS: ${error.message}`);
                throw error;
            }
        } else {
            this.logger.warn(`Cannot send recall for ${opp.patient.name}: Missing phone or doctor context`);
        }

        return this.prisma.recallOpportunity.update({
            where: { id: opportunityId },
            data: { status: 'SENT', lastContacted: new Date() }
        });
    }

    async dismissRecall(opportunityId: string) {
        return this.prisma.recallOpportunity.update({
            where: { id: opportunityId },
            data: { status: 'DISMISSED' }
        });
    }
}
