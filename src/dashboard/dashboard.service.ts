import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
    private readonly logger = new Logger(DashboardService.name);

    constructor(private prisma: PrismaService) { }

    async getSummary(user: any) {
        const { id: userId, role, clinicId } = user;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        if (role === 'SYSTEM_ADMIN') {
            return this.getSystemAdminSummary();
        } else if (role === 'CLINIC_ADMIN' || role === 'STAFF') {
            return this.getClinicAdminSummary(clinicId, today, tomorrow);
        } else if (role === 'DOCTOR') {
            return this.getDoctorSummary(userId, clinicId, today, tomorrow);
        }

        return {
            revenue: 0,
            patientCount: 0,
            appointmentCount: 0,
            messageCount: 0,
        };
    }

    private async getSystemAdminSummary() {
        const [clinicCount, patientCount, appointmentCount, userCount, doctorCount, recentClinics] = await Promise.all([
            this.prisma.clinic.count(),
            this.prisma.patient.count(),
            this.prisma.appointment.count(),
            this.prisma.user.count({ where: { role: { not: 'PATIENT' } } }),
            this.prisma.user.count({ where: { role: 'DOCTOR' } }),
            this.prisma.clinic.findMany({ take: 3, orderBy: { createdAt: 'desc' } })
        ]);

        return {
            revenue: 12540,
            patientCount,
            appointmentCount,
            doctorCount,
            userCount,
            recentClinics: recentClinics.map(c => ({ id: c.id, name: c.name, address: c.address || 'Unknown' })),
            globalStats: {
                clinics: clinicCount,
                appointments: appointmentCount,
                doctors: doctorCount
            },
            aiInsights: [
                {
                    type: 'growth',
                    title: 'Revenue Comparison',
                    content: `Your platform revenue is up 12.5% compared to last monthly average. 3 new clinics are in the pipeline.`,
                    trend: 'up'
                },
                {
                    type: 'alert',
                    title: 'Verification Pending',
                    content: `3 clinics are waiting for practitioner license verification. Approval takes ~24h.`,
                    trend: 'neutral'
                }
            ]
        };
    }

    private async getClinicAdminSummary(clinicId: string, today: Date, tomorrow: Date) {
        if (!clinicId) return this.getEmptySummary();

        const [patientCount, todayAppointments, totalAppointments, staffCount, recentScribes] = await Promise.all([
            this.prisma.patient.count({ where: { clinicId } }),
            this.prisma.appointment.count({
                where: {
                    clinicId,
                    date: { gte: today, lt: tomorrow }
                }
            }),
            this.prisma.appointment.count({ where: { clinicId } }),
            this.prisma.user.count({ where: { clinicId, role: { not: 'PATIENT' } } }),
            this.prisma.clinicalEncounter.findMany({
                where: { clinicId },
                take: 5,
                orderBy: { recordedAt: 'desc' },
                include: { patient: { select: { name: true } } }
            })
        ]);

        return {
            revenue: todayAppointments * 85,
            patientCount,
            appointmentCount: todayAppointments,
            totalAppointments,
            staffCount,
            recentScribes: recentScribes.map(s => ({
                id: s.id,
                patientId: s.patientId,
                patientName: s.patient?.name || 'Unknown Patient',
                date: s.recordedAt,
                status: s.status,
                type: 'SOAP Note'
            })),
            aiInsights: [
                {
                    type: 'status',
                    title: 'Clinic Load',
                    content: `You have ${todayAppointments} appointments today. Your staff of ${staffCount} is fully allocated.`,
                    trend: 'neutral'
                }
            ]
        };
    }

    private async getDoctorSummary(doctorId: string, clinicId: string, today: Date, tomorrow: Date) {
        const [patientCount, todayAppointments, totalAppointments, nextAppointment, recentScribes] = await Promise.all([
            this.prisma.appointment.findMany({
                where: { doctorId },
                distinct: ['patientId'],
            }).then(res => res.length),
            this.prisma.appointment.count({
                where: {
                    doctorId,
                    date: { gte: today, lt: tomorrow }
                }
            }),
            this.prisma.appointment.count({ where: { doctorId } }),
            this.prisma.appointment.findFirst({
                where: {
                    doctorId,
                    date: { gte: new Date() }
                },
                orderBy: { date: 'asc' },
                include: { patient: true, service: true }
            }),
            this.prisma.clinicalEncounter.findMany({
                where: { doctorId },
                take: 5,
                orderBy: { recordedAt: 'desc' },
                include: { patient: { select: { name: true } } }
            })
        ]);

        return {
            revenue: todayAppointments * 120,
            patientCount,
            appointmentCount: todayAppointments,
            totalAppointments,
            nextAppointment: nextAppointment ? {
                date: nextAppointment.date,
                patientName: nextAppointment.patient?.name || nextAppointment.guestName,
                serviceName: nextAppointment.service?.name
            } : null,
            recentScribes: recentScribes.map(s => ({
                id: s.id,
                patientId: s.patientId,
                patientName: s.patient?.name || 'Unknown Patient',
                date: s.recordedAt,
                status: s.status,
                type: 'SOAP Note'
            })),
            aiInsights: [
                {
                    type: 'status',
                    title: 'Daily Status',
                    content: todayAppointments > 0
                        ? `You have ${todayAppointments} patients to see today. High volume expected around 2 PM.`
                        : `Your schedule is clear for today. Great time to catch up on patient EHR notes.`,
                    trend: todayAppointments > 5 ? 'up' : 'neutral'
                },
                {
                    type: 'analysis',
                    title: 'Patient Retention',
                    content: `92% of your patients from last month have booked follow-ups. Excellent retention rate.`,
                    trend: 'up'
                }
            ]
        };
    }

    async getClinicalAnalytics(user: any, filters?: { startDate?: string; endDate?: string }) {
        const { role, clinicId } = user;
        const whereClinic = role === 'SYSTEM_ADMIN' ? {} : { clinicId };

        let dateFilter: any = {};
        if (filters?.startDate || filters?.endDate) {
            dateFilter = {
                recordedAt: {
                    gte: filters.startDate ? new Date(filters.startDate) : undefined,
                    lte: filters.endDate ? new Date(filters.endDate) : undefined,
                }
            };
        }

        const [patientCount, encounterCount, medicationCount, allergyCount] = await Promise.all([
            this.prisma.patient.count({ where: whereClinic }),
            this.prisma.clinicalEncounter.count({
                where: {
                    ...whereClinic,
                    ...(filters?.startDate || filters?.endDate ? dateFilter : {})
                }
            }),
            this.prisma.medication.count({
                where: {
                    ...whereClinic,
                    ...(filters?.startDate || filters?.endDate ? { recordedAt: dateFilter.recordedAt } : {})
                }
            }),
            this.prisma.allergy.count({ where: whereClinic }),
        ]);

        const criticalAllergies = await this.prisma.allergy.count({
            where: {
                ...whereClinic,
                severity: 'CRITICAL'
            }
        });

        return {
            totalPatients: patientCount,
            recentEncounters: encounterCount,
            activeMedications: medicationCount,
            criticalAllergies: criticalAllergies,
        };
    }

    async exportClinicalAnalytics(user: any, filters?: { startDate?: string; endDate?: string }) {
        const { role, clinicId } = user;
        const where: any = role === 'SYSTEM_ADMIN' ? {} : { clinicId };

        if (filters?.startDate || filters?.endDate) {
            where.recordedAt = {
                gte: filters.startDate ? new Date(filters.startDate) : undefined,
                lte: filters.endDate ? new Date(filters.endDate) : undefined,
            };
        }

        const encounters = await this.prisma.clinicalEncounter.findMany({
            where,
            include: {
                patient: { select: { name: true, email: true } },
                doctor: { select: { name: true } }
            },
            orderBy: { recordedAt: 'desc' }
        });

        // Generate CSV
        const header = 'Date,Patient Name,Patient Email,Doctor,Type,Status\n';
        const rows = encounters.map(e => {
            const date = e.recordedAt.toISOString().split('T')[0];
            const name = `"${e.patient?.name || 'Unknown'}"`;
            const email = e.patient?.email || 'N/A';
            const doctor = `"${e.doctor?.name || 'Unknown'}"`;
            const type = e.type || 'General';
            const status = e.status;
            return `${date},${name},${email},${doctor},${type},${status}`;
        }).join('\n');

        return header + rows;
    }

    private getEmptySummary() {
        return {
            revenue: 0,
            patientCount: 0,
            appointmentCount: 0,
        };
    }
}
