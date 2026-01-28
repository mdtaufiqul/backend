import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MeetingProvider, MeetingType, MeetingStatus, ParticipantRole, ParticipantStatus } from '@prisma/client';
import { DynamicMailerService } from '../services/dynamic-mailer.service';
import { WorkflowOrchestrator } from '../workflow/workflow.orchestrator';

@Injectable()
export class MeetingsService {
    private readonly logger = new Logger(MeetingsService.name);

    constructor(
        private prisma: PrismaService,
        private mailer: DynamicMailerService,
        private workflowOrchestrator: WorkflowOrchestrator
    ) { }

    async create(data: any, userId: string, userRole: string, clinicId?: string) {
        this.logger.log(`Creating meeting: ${data.title}`);

        const effectiveClinicId = data.clinicId || clinicId;
        if (!effectiveClinicId) {
            throw new NotFoundException('Clinic ID is required to create a meeting. Please ensure you are logged in to a clinic context.');
        }

        const provider = data.provider || MeetingProvider.INTERNAL;
        const type = data.meetingType || MeetingType.SCHEDULED;
        const meetingLink = `https://meet.mediflow.app/${provider.toLowerCase()}/${Date.now()}`;

        const participantsData: any[] = [];

        // Add creator as HOST
        participantsData.push({
            userId: userId,
            role: ParticipantRole.HOST,
            status: ParticipantStatus.JOINED
        });

        // Add other participants
        if (data.participantIds && Array.isArray(data.participantIds)) {
            data.participantIds.forEach((pId: string) => {
                if (pId !== userId) {
                    participantsData.push({
                        userId: pId,
                        role: ParticipantRole.ATTENDEE,
                        status: ParticipantStatus.INVITED
                    });
                }
            });
        }

        if (data.patientIds && Array.isArray(data.patientIds)) {
            data.patientIds.forEach((pId: string) => {
                participantsData.push({
                    patientId: pId,
                    role: ParticipantRole.ATTENDEE,
                    status: ParticipantStatus.INVITED
                });
            });
        }

        const meeting = await this.prisma.meeting.create({
            data: {
                title: data.title,
                description: data.description,
                startTime: new Date(data.startTime),
                endTime: new Date(data.endTime),
                timezone: data.timezone || 'UTC',
                clinicId: effectiveClinicId,
                createdBy: userId,
                createdByRole: userRole,
                meetingType: type,
                provider: provider,
                meetingLink: meetingLink,
                status: MeetingStatus.SCHEDULED,
                participants: {
                    create: participantsData
                }
            },
            include: {
                creator: { select: { name: true } },
                participants: {
                    include: {
                        user: { select: { id: true, name: true, email: true } },
                        patient: { select: { id: true, name: true, email: true, phone: true } }
                    }
                }
            }
        });

        // Send Email Invitations
        try {
            const formattedDate = new Date(data.startTime).toLocaleString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZoneName: 'short'
            });

            const emailPromises = meeting.participants.map(async (p) => {
                const recipientEmail = p.user?.email || p.patient?.email;
                const recipientName = p.user?.name || p.patient?.name || 'Participant';

                if (!recipientEmail) return;

                await this.mailer.sendMail(userId, {
                    to: recipientEmail,
                    subject: `Meeting Invitation: ${meeting.title}`,
                    html: `
                        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                            <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-bottom: 1px solid #e2e8f0;">
                                <h2 style="color: #0f172a; margin: 0;">New Meeting Invitation</h2>
                            </div>
                            <div style="padding: 24px;">
                                <p>Hello <strong>${recipientName}</strong>,</p>
                                <p>You have been invited to a meeting by <strong>${meeting.creator?.name || 'The Clinic'}</strong>.</p>
                                
                                <div style="background-color: #f1f5f9; padding: 16px; border-radius: 6px; margin: 20px 0;">
                                    <h3 style="margin-top: 0; color: #334155;">${meeting.title}</h3>
                                    ${meeting.description ? `<p style="color: #64748b; margin-bottom: 12px;">${meeting.description}</p>` : ''}
                                    <p style="margin: 4px 0;"><strong>📅 When:</strong> ${formattedDate}</p>
                                    <p style="margin: 4px 0;"><strong>📹 Provider:</strong> ${meeting.provider}</p>
                                </div>

                                <div style="text-align: center; margin-top: 30px;">
                                    <a href="${meetingLink}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                                        Join Meeting
                                    </a>
                                </div>
                                <p style="text-align: center; font-size: 12px; color: #94a3b8; margin-top: 20px;">
                                    If the button doesn't work, copy this link: <br/>${meetingLink}
                                </p>
                            </div>
                        </div>
                    `
                });
            });

            await Promise.allSettled(emailPromises);
            this.logger.log(`Sent invitations for meeting ${meeting.id}`);

        } catch (error) {
            this.logger.error("Failed to send meeting invitations", error);
            // Don't block return
        }

        // Trigger Workflow for Patients
        try {
            const patientParticipants = meeting.participants.filter(p => p.patientId);
            for (const p of patientParticipants) {
                if (p.patientId) {
                    await this.workflowOrchestrator.triggerEvent('MEETING_CREATED', {
                        patientId: p.patientId,
                        clinicId: effectiveClinicId,
                        meetingId: meeting.id,
                        meetingTitle: meeting.title,
                        startTime: meeting.startTime.toISOString(),
                        email: p.patient?.email,
                        phone: p.patient?.phone,
                        name: p.patient?.name
                    });
                }
            }
        } catch (error) {
            this.logger.error("Failed to trigger meeting creation workflows", error);
        }

        return meeting;
    }

    async findAll(clinicId: string, userId: string, role: string) {
        const where: any = {};

        // 1. Clinic Scoping
        if (role === 'SAAS_OWNER') {
            // Super admin can see all, or filter by clinic if provided
            if (clinicId) where.clinicId = clinicId;
        } else if (clinicId) {
            where.clinicId = clinicId;
        } else {
            // If user has no clinic and is not super admin, they see nothing (or only their own cross-clinic invites?)
            // For safety, return empty for now to avoid Prisma crash on missing clinicId
            return [];
        }

        // 2. Role-based filtering (Stack on top of clinic scope)
        if (role === 'DOCTOR') {
            // Doctors see meetings they created OR are participating in
            where.OR = [
                { createdBy: userId },
                {
                    participants: {
                        some: { userId: userId }
                    }
                }
            ];
        } else if (role === 'SYSTEM_ADMIN' || role === 'CLINIC_ADMIN' || role === 'SAAS_OWNER') {
            // Admins see all clinic meetings (filtered by clinicId above)
        } else {
            // Others (Staff) see only what they are invited to
            where.participants = {
                some: { userId: userId }
            };
        }

        return this.prisma.meeting.findMany({
            where,
            orderBy: { startTime: 'desc' },
            include: {
                creator: { select: { id: true, name: true } },
                participants: {
                    include: {
                        user: { select: { id: true, name: true, image: true } },
                        patient: { select: { id: true, name: true, email: true, phone: true } }
                    }
                }
            }
        });
    }

    async findOne(id: string) {
        const meeting = await this.prisma.meeting.findUnique({
            where: { id },
            include: {
                creator: { select: { id: true, name: true } },
                participants: {
                    include: {
                        user: { select: { id: true, name: true, image: true } },
                        patient: { select: { id: true, name: true, email: true, phone: true } }
                    }
                },
                auditLogs: {
                    orderBy: { timestamp: 'desc' },
                    take: 10
                }
            }
        });

        if (!meeting) {
            throw new NotFoundException(`Meeting with ID ${id} not found`);
        }
        return meeting;
    }

    async remove(id: string, userId: string) {
        // Only creator or admin can delete
        const meeting = await this.findOne(id);

        // TODO: Access check (simplified)
        if (meeting.createdBy !== userId) {
            // allow admins override check here
        }

        return this.prisma.meeting.update({
            where: { id },
            data: { status: MeetingStatus.CANCELLED }
        });
    }
}
