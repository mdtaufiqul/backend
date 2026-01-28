import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ROLES } from '../shared/constants/roles.constant';

@Injectable()
export class EhrService {
    constructor(private prisma: PrismaService) { }

    private async verifyAccess(patientId: string, user: any) {
        const { role, id: userId, clinicId } = user;
        const normalizedRole = role?.toUpperCase();

        const patient = await this.prisma.patient.findUnique({
            where: { id: patientId },
            include: { appointments: true }
        });

        if (!patient) {
            throw new NotFoundException(`Patient with ID ${patientId} not found`);
        }

        // Clinic Scoping
        if (clinicId && patient.clinicId !== clinicId) {
            throw new ForbiddenException('Access denied: Patient belongs to another clinic');
        } else if (!clinicId && normalizedRole !== ROLES.SAAS_OWNER) {
            throw new ForbiddenException('Access denied: User has no clinic context');
        }

        // Doctor Scoping
        if (normalizedRole === ROLES.DOCTOR) {
            const hasAppointment = patient.appointments.some(a => a.doctorId === userId);
            const isAssigned = patient.assignedDoctorId === userId;

            if (!hasAppointment && !isAssigned) {
                throw new ForbiddenException('Access denied: No clinical relationship');
            }
        }
    }

    // --- VITALS ---
    async getVitals(patientId: string, user: any) {
        await this.verifyAccess(patientId, user);
        return this.prisma.vitals.findMany({
            where: { patientId },
            orderBy: { recordedAt: 'desc' }
        });
    }

    async addVitals(patientId: string, data: any, user: any) {
        await this.verifyAccess(patientId, user);

        // Map vitals fields to observations
        const mappings = [
            { key: 'weight', type: 'weight', unit: 'kg' },
            { key: 'height', type: 'height', unit: 'cm' },
            { key: 'bpSystolic', type: 'blood_pressure', isBP: true },
            { key: 'temperature', type: 'temperature', unit: 'Celsius' },
            { key: 'heartRate', type: 'heart_rate', unit: 'bpm' },
            { key: 'respiratoryRate', type: 'respiratory_rate', unit: 'bpm' },
            { key: 'spO2', type: 'spo2', unit: '%' },
        ];

        return this.prisma.$transaction(async (tx) => {
            // 1. Create legacy Vitals record - explicitly pick fields to avoid unknown arg errors (like 'position')
            const vitals = await tx.vitals.create({
                data: {
                    weight: data.weight,
                    height: data.height,
                    bmi: data.bmi,
                    bpSystolic: data.bpSystolic,
                    bpDiastolic: data.bpDiastolic,
                    temperature: data.temperature,
                    heartRate: data.heartRate,
                    respiratoryRate: data.respiratoryRate,
                    spO2: data.spO2,
                    patientId,
                    encounterId: data.encounterId,
                    clinicId: user.clinicId,
                    doctorId: user.id
                }
            });

            // 2. Create PatientObservation records
            const observations: any[] = [];
            for (const m of mappings) {
                if (data[m.key] !== undefined && data[m.key] !== null) {
                    if (m.isBP) {
                        // Special handling for BP to avoid multiple BP records if both systolic and diastolic are present
                        // We only trigger BP creation on systolic and include diastolic
                        if (m.key === 'bpSystolic') {
                            observations.push({
                                patientId,
                                encounterId: data.encounterId,
                                clinicId: user.clinicId,
                                recordedByUserId: user.id,
                                type: 'blood_pressure',
                                value: `${data.bpSystolic}/${data.bpDiastolic || '--'}`,
                                unit: 'mmHg',
                                systolic: parseInt(data.bpSystolic),
                                diastolic: data.bpDiastolic ? parseInt(data.bpDiastolic) : undefined,
                                position: data.position,
                                method: data.method,
                                status: 'FINAL'
                            });
                        }
                    } else {
                        observations.push({
                            patientId,
                            encounterId: data.encounterId,
                            clinicId: user.clinicId,
                            recordedByUserId: user.id,
                            type: m.type,
                            value: data[m.key].toString(),
                            unit: m.unit,
                            status: 'FINAL'
                        });
                    }
                }
            }

            if (observations.length > 0) {
                await tx.patientObservation.createMany({
                    data: observations
                });
            }

            return vitals;
        });
    }

    async bulkCreateObservations(patientId: string, observations: any[], user: any) {
        await this.verifyAccess(patientId, user);

        const data = observations.map(obs => ({
            ...obs,
            patientId,
            clinicId: user.clinicId,
            recordedByUserId: user.id,
            status: 'FINAL'
        }));

        return this.prisma.patientObservation.createMany({ data });
    }

    // --- DIAGNOSES ---
    async getDiagnoses(patientId: string, user: any) {
        await this.verifyAccess(patientId, user);
        return this.prisma.diagnosis.findMany({
            where: { patientId },
            orderBy: { recordedAt: 'desc' }
        });
    }

    async addDiagnosis(patientId: string, data: any, user: any) {
        await this.verifyAccess(patientId, user);
        return this.prisma.diagnosis.create({
            data: {
                ...data,
                patientId,
                encounterId: data.encounterId, // Linked to encounter
                clinicId: user.clinicId,
                doctorId: user.id
            }
        });
    }

    // --- MEDICATIONS ---
    async getMedications(patientId: string, user: any) {
        await this.verifyAccess(patientId, user);
        return this.prisma.medication.findMany({
            where: { patientId },
            orderBy: { recordedAt: 'desc' }
        });
    }

    async addMedication(patientId: string, data: any, user: any) {
        await this.verifyAccess(patientId, user);
        return this.prisma.medication.create({
            data: {
                ...data,
                patientId,
                encounterId: data.encounterId, // Linked to encounter
                clinicId: user.clinicId,
                doctorId: user.id
            }
        });
    }

    async updateMedication(medId: string, data: any, user: any) {
        const med = await this.prisma.medication.findUnique({ where: { id: medId } });
        if (!med) throw new NotFoundException('Medication not found');
        await this.verifyAccess(med.patientId, user);

        return this.prisma.medication.update({
            where: { id: medId },
            data
        });
    }

    // --- ALLERGIES ---
    async getAllergies(patientId: string, user: any) {
        await this.verifyAccess(patientId, user);
        return this.prisma.allergy.findMany({
            where: { patientId },
            orderBy: { recordedAt: 'desc' }
        });
    }

    async addAllergy(patientId: string, data: any, user: any) {
        await this.verifyAccess(patientId, user);
        return this.prisma.allergy.create({
            data: {
                ...data,
                patientId,
                encounterId: data.encounterId, // Linked to encounter
                clinicId: user.clinicId,
                doctorId: user.id
            }
        });
    }

    async updateAllergy(allergyId: string, data: any, user: any) {
        const allergy = await this.prisma.allergy.findUnique({ where: { id: allergyId } });
        if (!allergy) throw new NotFoundException('Allergy not found');
        await this.verifyAccess(allergy.patientId, user);

        return this.prisma.allergy.update({
            where: { id: allergyId },
            data
        });
    }

    // --- ENCOUNTERS (SOAP) ---
    async getEncounters(patientId: string, user: any) {
        await this.verifyAccess(patientId, user);
        return this.prisma.clinicalEncounter.findMany({
            where: { patientId },
            include: { doctor: { select: { name: true } }, appointment: true },
            orderBy: { recordedAt: 'desc' }
        });
    }

    async createEncounter(patientId: string, data: any, user: any) {
        await this.verifyAccess(patientId, user);

        // If an appointmentId is provided, check if an encounter already exists for it
        if (data.appointmentId) {
            const existing = await this.prisma.clinicalEncounter.findUnique({
                where: { appointmentId: data.appointmentId }
            });
            if (existing) {
                return existing;
            }
        }

        return this.prisma.clinicalEncounter.create({
            data: {
                ...data,
                patientId,
                clinicId: user.clinicId,
                doctorId: user.id,
                status: 'DRAFT'
            }
        });
    }

    async updateEncounter(encounterId: string, data: any, user: any) {
        const encounter = await this.prisma.clinicalEncounter.findUnique({
            where: { id: encounterId }
        });

        if (!encounter) throw new NotFoundException('Encounter not found');
        if (encounter.status === 'FINALIZED') {
            throw new ForbiddenException('Cannot edit a finalized encounter. Use addendums instead.');
        }

        await this.verifyAccess(encounter.patientId, user);

        return this.prisma.clinicalEncounter.update({
            where: { id: encounterId },
            data: {
                ...data,
                recordedAt: undefined // Prevent accidental timestamp changes
            }
        });
    }

    async finalizeEncounter(encounterId: string, user: any) {
        const encounter = await this.prisma.clinicalEncounter.findUnique({
            where: { id: encounterId }
        });

        if (!encounter) throw new NotFoundException('Encounter not found');
        await this.verifyAccess(encounter.patientId, user);

        return this.prisma.clinicalEncounter.update({
            where: { id: encounterId },
            data: {
                status: 'FINALIZED',
                finalizedAt: new Date()
            }
        });
    }


    // --- OBSERVATIONS (Time-Series Vitals) ---

    async getLatestPatientObservations(patientId: string, user: any) {
        await this.verifyAccess(patientId, user);

        // Optimized query: get all final observations for types, sorted by date
        // Then filter to get only the latest for each type
        const observations = await this.prisma.patientObservation.findMany({
            where: { patientId, status: 'FINAL' },
            orderBy: [{ type: 'asc' }, { recordedAt: 'desc' }],
            include: { recordedByUser: { select: { name: true } } }
        });

        // Use a map to keep only the first (latest) occurrence of each type
        const latestMap = new Map();
        for (const obs of observations) {
            if (!latestMap.has(obs.type)) {
                latestMap.set(obs.type, obs);
            }
        }

        return Array.from(latestMap.values());
    }

    async getPatientObservationHistory(patientId: string, type: string, user: any) {
        await this.verifyAccess(patientId, user);

        return this.prisma.patientObservation.findMany({
            where: { patientId, type, status: 'FINAL' },
            orderBy: { recordedAt: 'asc' }, // Ascending for charts
            include: { recordedByUser: { select: { name: true } }, encounter: true }
        });
    }

    async createObservation(patientId: string, data: any, user: any) {
        await this.verifyAccess(patientId, user);

        // Special handling for Blood Pressure
        if (data.type === 'blood_pressure' && data.systolic && data.diastolic) {
            data.value = `${data.systolic}/${data.diastolic}`;
            data.unit = 'mmHg';
        }

        return this.prisma.patientObservation.create({
            data: {
                ...data,
                patientId,
                clinicId: user.clinicId,
                recordedByUserId: user.id,
                status: 'FINAL'
            }
        });
    }

    async amendObservation(observationId: string, newData: any, user: any) {
        const oldObs = await this.prisma.patientObservation.findUnique({
            where: { id: observationId }
        });

        if (!oldObs) throw new NotFoundException('Observation not found');
        await this.verifyAccess(oldObs.patientId, user);

        if (oldObs.status !== 'FINAL') {
            throw new ForbiddenException('Can only amend FINAL observations');
        }

        // Transaction: Void old, create new
        return this.prisma.$transaction(async (tx) => {
            // Void the old one
            await tx.patientObservation.update({
                where: { id: observationId },
                data: { status: 'AMENDED' }
            });

            // Create the new one
            return tx.patientObservation.create({
                data: {
                    ...newData,
                    patientId: oldObs.patientId,
                    clinicId: user.clinicId,
                    recordedByUserId: user.id,
                    encounterId: oldObs.encounterId, // Keep original encounter context unless overridden
                    amendedFromId: observationId,
                    status: 'FINAL'
                }
            });
        });
    }

    async getEncounterObservations(encounterId: string, user: any) {
        // First get the encounter to verify clinic/doctor access
        const encounter = await this.prisma.clinicalEncounter.findUnique({
            where: { id: encounterId },
            include: { clinic: true }
        });

        if (!encounter) throw new NotFoundException('Encounter not found');
        // Basic clinic check
        if (encounter.clinicId !== user.clinicId) throw new ForbiddenException('Unauthorized');

        return this.prisma.patientObservation.findMany({
            where: { encounterId, status: { not: 'VOIDED' } },
            include: { recordedByUser: { select: { name: true } } }
        });
    }
}
