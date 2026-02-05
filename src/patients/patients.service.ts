import { Injectable, ForbiddenException, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Patient } from '@prisma/client';
import { ROLES } from '../shared/constants/roles.constant';
import * as jwt from 'jsonwebtoken';
import { DynamicMailerService } from '../services/dynamic-mailer.service';

@Injectable()
export class PatientsService {
    constructor(
        private prisma: PrismaService,
        private mailerService: DynamicMailerService
    ) { }

    async findAll(user: any, search?: string): Promise<Patient[]> {
        const { clinicId, role, id: userId } = user;
        const normalizedRole = role?.toUpperCase();

        const whereClause: any = {};

        // 0. Superuser Global Access
        if (normalizedRole === ROLES.SAAS_OWNER) {
            if (clinicId) whereClause.clinicId = clinicId;
        }
        // 1. Basic Clinic Scoping (High Priority)
        else if (clinicId) {
            whereClause.clinicId = clinicId;
        } else {
            console.warn(`[PatientsService] Security block: Headless user ${userId} (${normalizedRole}) attempted fetch.`);
            return [];
        }

        // 2. Doctor Specific Scoping
        if (normalizedRole === ROLES.DOCTOR) {
            whereClause.OR = [
                {
                    appointments: {
                        some: { doctorId: userId }
                    }
                },
                {
                    assignedDoctorId: userId
                }
            ];
        }

        // 3. Search Filtering
        if (search) {
            const searchFilter = {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } },
                    { phone: { contains: search, mode: 'insensitive' } }
                ]
            };

            // Allow combining with existing constraints
            if (!whereClause.AND) {
                whereClause.AND = [];
            }
            if (Array.isArray(whereClause.AND)) {
                whereClause.AND.push(searchFilter);
            }
        }

        console.log(`[PatientsService] Scoping query for ${normalizedRole} (${userId}) in clinic ${clinicId || 'GLOBAL'} with search: ${search || 'NONE'}`);

        return this.prisma.patient.findMany({
            where: whereClause,
            include: {
                appointments: {
                    orderBy: { createdAt: 'desc' },
                    include: { doctor: { select: { name: true, timezone: true } } },
                    take: 1
                }
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async findOne(id: string, user: any): Promise<Patient> {
        const { role, id: userId, clinicId } = user;
        const normalizedRole = role?.toUpperCase();

        const patient = await this.prisma.patient.findUnique({
            where: { id },
            include: {
                appointments: {
                    include: {
                        doctor: { select: { name: true, timezone: true } },
                        service: true,
                        intakeSession: true
                    },
                    orderBy: { date: 'desc' }
                },
                formSubmissions: {
                    include: { form: true },
                    orderBy: { createdAt: 'desc' }
                },
                files: {
                    orderBy: { createdAt: 'desc' }
                },
                notes: {
                    include: { doctor: { select: { name: true } } },
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!patient) {
            throw new NotFoundException(`Patient with ID ${id} not found`);
        }

        // SECURITY: Enforce Clinic Scoping
        if (normalizedRole === ROLES.SAAS_OWNER) {
            // Allowed to access any patient
        } else if (clinicId && patient.clinicId !== clinicId) {
            // SYSTEM_ADMIN is no longer exempt. They must match the clinic.
            throw new ForbiddenException('Access denied: Patient belongs to another clinic');
        } else if (!clinicId) {
            throw new ForbiddenException('Access denied: User has no clinic context');
        }

        // SECURITY: Enforce Doctor Relationship
        if (normalizedRole === ROLES.DOCTOR) {
            const hasAppointment = patient.appointments.some(a => a.doctorId === userId);
            const isAssigned = patient.assignedDoctorId === userId;

            if (!hasAppointment && !isAssigned) {
                console.warn(`SECURITY ALERT: Doctor ${userId} attempted to access unscoped patient ${id}`);
                throw new ForbiddenException('Access denied: You do not have a clinical relationship with this patient');
            }
        }

        return patient;
    }

    async create(data: any, user: any): Promise<Patient> {
        console.log('Creating Patient with data:', data);

        // Validation: Mandatory Fields
        if (!data.firstName || !data.email || !data.gender) {
            // Check if name is passed instead of firstName
             if (!data.name && !data.firstName) {
                 throw new BadRequestException('First Name, Email, and Gender are required.');
             }
             if (!data.email) throw new BadRequestException('Email is required.');
             if (!data.gender) throw new BadRequestException('Gender is required.');
        }

        // Validation: Email Format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(data.email)) {
            throw new BadRequestException('Invalid email format.');
        }

        // Validation: Unique Email
        const emailExists = await this.checkEmailExists(data.email, data.clinicId || user.clinicId);
        if (emailExists.exists) {
            throw new ConflictException('Patient with this email already exists.');
        }

        try {
            const name = data.name || `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Unknown';
            
            // Auto-assign to creating doctor if not specified
            let assignedDoctorId = data.assignedDoctorId;
            if (!assignedDoctorId && user.role?.toUpperCase() === 'DOCTOR') {
                assignedDoctorId = user.id;
            }

            const patient = await this.prisma.patient.create({
                data: {
                    name: name,
                    email: data.email,
                    phone: data.phone,
                    address: data.address,
                    gender: data.gender,
                    age: data.age,
                    dob: data.dob ? new Date(data.dob) : undefined,
                    clinicId: data.clinicId || user.clinicId,
                    assignedDoctorId: assignedDoctorId
                },
            });

            // Send Set Password Email
            await this.sendSetPasswordEmail(patient);

            return patient;

        } catch (error) {
            console.error('Error creating patient:', error);
            throw error;
        }
    }

    async sendSetPasswordEmail(patient: Patient) {
        try {
            const secret = process.env.JWT_SECRET || 'supersecret';
            const token = jwt.sign(
                { id: patient.id, email: patient.email, type: 'patient_invite' },
                secret,
                { expiresIn: '48h' }
            );

            const appUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            const setPasswordLink = `${appUrl}/reset-password?token=${token}&type=patient`;

            await this.mailerService.sendMail(undefined, {
                to: patient.email!,
                subject: 'Welcome to MediFlow - Set your password',
                html: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2>Welcome to MediFlow</h2>
                        <p>Hello ${patient.name},</p>
                        <p>Your patient account has been created. Please click the button below to set your password and access your portal.</p>
                        <a href="${setPasswordLink}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 16px 0;">Set Password</a>
                        <p>This link will expire in 48 hours.</p>
                    </div>
                `
            });
            console.log(`[PatientsService] Password set email sent to ${patient.email}`);
        } catch (error) {
            console.error('[PatientsService] Failed to send password set email:', error);
            // Don't block creation if email fails, but log it.
        }
    }

    async addNote(patientId: string, content: string, user: any) {
        // Verify access first
        await this.findOne(patientId, user);

        return this.prisma.patientNote.create({
            data: {
                content,
                patientId,
                doctorId: user.id
            },
            include: { doctor: { select: { name: true } } }
        });
    }

    async addFile(patientId: string, fileData: { name: string; url: string; type: string; size: number }, user: any) {
        // Verify access first
        await this.findOne(patientId, user);

        return this.prisma.patientFile.create({
            data: {
                ...fileData,
                patientId
            }
        });
    }

    async getCommunicationLogs(patientId: string, user: any) {
        console.log(`DEBUG: Fetching logs for patient ${patientId} with user scoping`);
        try {
            // First verify user can access this patient
            await this.findOne(patientId, user);

            const whereClause: any = { patientId };
            const normalizedRole = user?.role?.toUpperCase();

            // Doctor Scoping: Only see logs they initiated or related to their appointments
            if (normalizedRole === 'DOCTOR') {
                whereClause.OR = [
                    { providerId: user.id },
                    { appointment: { doctorId: user.id } }
                ];
            }

            const logs = await this.prisma.communicationLog.findMany({
                where: whereClause,
                include: { appointment: { include: { service: true } } },
                orderBy: { sentAt: 'desc' }
            });
            return logs;
        } catch (error) {
            console.error('DEBUG: Error querying communication logs:', error);
            // Return empty array instead of crashing to unblock the UI
            return [];
        }
    }

    async checkEmailExists(email: string, clinicId?: string) {
        const whereClause: any = {
            email: {
                equals: email,
                mode: 'insensitive'
            }
        };

        if (clinicId) {
            whereClause.clinicId = clinicId;
        }

        const patient = await this.prisma.patient.findFirst({
            where: whereClause,
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                dob: true
            }
        });

        if (patient) {
            return {
                exists: true,
                user: patient // Returning as 'user' to match frontend expectation (or update frontend)
            };
        }

        return { exists: false };
    }

    async remove(id: string, user: any) {
        const patient = await this.findOne(id, user);

        // Security: Only SYSTEM_ADMIN or user with manage_patients permission in the same clinic can delete
        const normalizedRole = user.role?.toUpperCase();
        if (normalizedRole !== ROLES.SAAS_OWNER && normalizedRole !== ROLES.SYSTEM_ADMIN && normalizedRole !== ROLES.CLINIC_ADMIN) {
            throw new ForbiddenException('Only administrators can delete patient records');
        }

        return this.prisma.patient.delete({
            where: { id }
        });
    }
}
