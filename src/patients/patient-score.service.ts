
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PatientScoreService {
    private readonly logger = new Logger(PatientScoreService.name);

    constructor(private prisma: PrismaService) { }

    // Scoring Weights (Reliability Score: 0-100, where 100 is perfectly reliable)
    private readonly SCORING_RULES = {
        STARTING_SCORE: 80,
        COMPLETED_BONUS: 10,
        CONFIRMED_BONUS: 5,
        REPLY_BONUS: 2,
        LATE_CANCELLATION_PENALTY: 15,
        NO_SHOW_PENALTY: 30,
        EARLY_CANCELLATION_PENALTY: 5,
    };

    /**
     * Recalculates and updates the No-Show Score for a patient
     */
    async recalculateScore(patientId: string) {
        // this.logger.log(`Recalculating score for patient ${patientId}`);

        const patient = await this.prisma.patient.findUnique({
            where: { id: patientId },
            include: {
                appointments: {
                    select: { status: true, date: true, isConfirmed: true, updatedAt: true },
                    orderBy: { date: 'desc' }, // Process recent first
                    take: 20 // Only consider last 20 appointments for relevance
                }
            }
        });

        if (!patient) return null;

        // Fetch Inbound Logs manually
        const inboundLogsCount = await this.prisma.communicationLog.count({
            where: { patientId, direction: 'INBOUND' }
        });

        let score = this.SCORING_RULES.STARTING_SCORE;

        // 1. Appointment Behavior (Last 20)
        for (const appt of patient.appointments) {
            const isLateCancel = appt.status === 'cancelled' &&
                (new Date(appt.date).getTime() - new Date(appt.updatedAt).getTime() < 24 * 60 * 60 * 1000);

            if (appt.status === 'completed') {
                score += this.SCORING_RULES.COMPLETED_BONUS;
            } else if (appt.status === 'no-show') {
                score -= this.SCORING_RULES.NO_SHOW_PENALTY;
            } else if (isLateCancel) {
                score -= this.SCORING_RULES.LATE_CANCELLATION_PENALTY;
            } else if (appt.status === 'cancelled') {
                score -= this.SCORING_RULES.EARLY_CANCELLATION_PENALTY;
            }

            if (appt.isConfirmed) {
                score += this.SCORING_RULES.CONFIRMED_BONUS;
            }
        }

        // 2. Engagement (Replies capped at +20)
        const engagementBonus = Math.min(inboundLogsCount * this.SCORING_RULES.REPLY_BONUS, 20);
        score += engagementBonus;

        // Clamp 0-100
        if (score > 100) score = 100;
        if (score < 0) score = 0;

        // Update DB
        await this.prisma.patient.update({
            where: { id: patientId },
            data: { noShowScore: score }
        });

        return score;
    }

    /**
     * Hook to call when a patient replies
     */
    async handlePatientReply(patientId: string) {
        // Increment score slightly without full recalc, or full recalc?
        // Let's do full recalc to be safe and consistent.
        return this.recalculateScore(patientId);
    }

    /**
     * Hook when appointment status changes
     */
    async handleStatusChange(patientId: string, status: string) {
        return this.recalculateScore(patientId);
    }
}
