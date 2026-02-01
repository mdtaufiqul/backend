import { Injectable, NotFoundException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MessagesGateway } from '../messages/messages.gateway';

import { WorkflowOrchestrator } from '../workflow/workflow.orchestrator';

@Injectable()
export class ConversationsService {
    constructor(
        private prisma: PrismaService,
        @Inject(forwardRef(() => MessagesGateway))
        private messagesGateway: MessagesGateway,
        private workflowOrchestrator: WorkflowOrchestrator
    ) { }

    /**
     * Get or create a conversation between a doctor and patient
     */
    async getOrCreateConversation(doctorId: string, patientId: string) {
        // Try to find existing conversation
        let conversation = await this.prisma.conversation.findFirst({
            where: {
                doctorId,
                patientId,
            },
            include: {
                doctor: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                patient: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        });

        // Create if doesn't exist
        if (!conversation) {
            // Fetch doctor to get their clinicId
            const doctor = await this.prisma.user.findUnique({
                where: { id: doctorId },
                select: { clinicId: true }
            });

            conversation = await this.prisma.conversation.create({
                data: {
                    doctorId,
                    patientId,
                    clinicId: doctor?.clinicId,
                    type: 'INTERNAL'
                },
                include: {
                    doctor: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                    patient: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
            });
        }

        return conversation;
    }

    /**
     * Get all conversations for a user based on their role
     */
    async findAll(userId: string, role: string, clinicId?: string, patientId?: string, type?: 'INTERNAL' | 'VISITOR') {
        // Normalize role to lowercase for consistent comparison
        const normalizedRole = role?.toLowerCase();

        const where: any = {};

        if (type) {
            where.type = type;
        }

        if (normalizedRole === 'doctor') {
            where.doctorId = userId;
            // Doctors should see Assigned Visitor Chats
            if (type === 'VISITOR') {
                delete where.doctorId;
                where.OR = [
                    { doctorId: userId },
                    { doctorId: null } // Unassigned
                ];
                where.clinicId = clinicId; // Must match clinic
            }
        } else if (normalizedRole === 'patient') {
            if (!patientId) {
                throw new ForbiddenException('Patient ID required');
            }
            where.patientId = patientId;
        } else if (['clinic_admin', 'clinic_representative', 'system_admin', 'saas_owner', 'staff', 'nurse'].includes(normalizedRole)) {
            if (clinicId) {
                where.clinicId = clinicId;
            }
            // If no clinicId (e.g. Super Admin), maybe unrestricted? 
            // For now, let's keep it scoped if clinicId exists, otherwise it might be empty if we require clinicId.
            // But let's assume SAAS_OWNER might want to see all.
            if (normalizedRole === 'saas_owner' && !clinicId) {
                // No filter on clinicId
            } else if (!clinicId && normalizedRole !== 'saas_owner') {
                 // throw new ForbiddenException('Clinic ID required');
                 // Don't throw, just return empty to be safe? Or allow global?
                 // Let's assume system_admin usually has a clinic context or is global. 
                 // If global, we verify no clinicId filter is applied.
            }
        } else {
            return [];
        }

        return this.prisma.conversation.findMany({
            where,
            include: {
                doctor: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                patient: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                visitor: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                messages: {
                    orderBy: {
                        createdAt: 'desc',
                    },
                    take: 1,
                },
            },
            orderBy: {
                lastMessageAt: 'desc',
            },
        });
    }

    /**
     * Get a specific conversation by ID with access validation
     */
    async findOne(conversationId: string, userId: string, role: string, clinicId?: string, patientId?: string) {
        // Normalize role to lowercase for consistent comparison
        const normalizedRole = role?.toLowerCase();

        const conversation = await this.prisma.conversation.findUnique({
            where: { id: conversationId },
            include: {
                doctor: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                patient: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        });

        if (!conversation) {
            throw new NotFoundException('Conversation not found');
        }

        // Validate access
        if (normalizedRole === 'doctor' && conversation.doctorId !== userId) {
            throw new ForbiddenException('Access denied');
        }

        if (normalizedRole === 'patient' && conversation.patientId !== patientId) {
            throw new ForbiddenException('Access denied');
        }

        if ((normalizedRole === 'clinic_admin' || normalizedRole === 'clinic_representative') && conversation.clinicId !== clinicId) {
            throw new ForbiddenException('Access denied - Clinic mismatch');
        }

        return conversation;
    }

    /**
     * Get messages for a conversation with access validation
     */
    async getMessages(conversationId: string, userId: string, role: string, clinicId?: string, patientId?: string) {
        // First validate access to the conversation
        await this.findOne(conversationId, userId, role, clinicId, patientId);

        // Fetch messages
        return this.prisma.message.findMany({
            where: {
                conversationId,
            },
            orderBy: {
                createdAt: 'asc',
            },
        });
    }

    /**
     * Send a message in a conversation
     */
    async sendMessage(
        conversationId: string,
        content: string,
        userId: string,
        role: string,
        clinicId?: string,
        patientId?: string,
        onBehalfOfId?: string
    ) {
        // Normalize role to lowercase for consistent comparison
        const normalizedRole = role?.toLowerCase();

        // Validate access to the conversation
        const conversation = await this.findOne(conversationId, userId, role, clinicId, patientId);

        // Determine sender type

        // Create the message
        const message = await this.prisma.message.create({
            data: {
                conversationId,
                content,
                senderId: normalizedRole === 'patient' ? null : userId,
                senderType: normalizedRole === 'patient' ? 'PATIENT' : 'USER',
                onBehalfOfId: onBehalfOfId || (normalizedRole === 'doctor' ? userId : undefined)
            },
        });

        // Update conversation's lastMessageAt
        await this.prisma.conversation.update({
            where: { id: conversationId },
            data: {
                lastMessageAt: new Date(),
            },
        });

        // Broadcast Real-time
        if (this.messagesGateway && this.messagesGateway.server) {
            const room = `conversation-${conversationId}`;
            this.messagesGateway.server.to(room).emit('newMessage', message);
        }

        // Also broadcast to patient room for global notifications
        if (conversation.patientId) {
            this.messagesGateway.server.to(`patient-${conversation.patientId}`).emit('newMessage', message);
        }

        return message;
    }

    /**
     * Handle Inbound Message (from Webhook)
     * Finds active conversation and injects message
     */
    async handleInboundMessage(patientId: string, content: string, metadata?: any) {
        // 1. Find the most relevant conversation
        // Ideally, find the conversation with the most recent activity
        let conversation = await this.prisma.conversation.findFirst({
            where: { patientId },
            orderBy: { lastMessageAt: 'desc' }
        });

        // 2. If no conversation exists, create one with the default doctor or admin
        if (!conversation) {
            // Find a master doctor or admin to assign
            const defaultUser = await this.prisma.user.findFirst({
                where: { role: 'doctor' } // Simplified logic
            });

            if (defaultUser) {
                conversation = await this.prisma.conversation.create({
                    data: {
                        patientId,
                        doctorId: defaultUser.id,
                        clinicId: defaultUser.clinicId,
                        lastMessageAt: new Date()
                    }
                });
            } else {
                console.error("No default user found to create conversation for inbound message");
                return null;
            }
        }

        // 3. Create the Message
        const message = await this.prisma.message.create({
            data: {
                conversationId: conversation.id,
                content: content,
                senderType: 'PATIENT',
                senderId: conversation.doctorId, // Attributing to the thread owner to satisfy FK
                direction: 'INBOUND',
                status: 'DELIVERED',
                externalId: metadata?.MessageSid,
                channel: 'SMS'
            }
        });

        // 4. Update conversation stats
        await this.prisma.conversation.update({
            where: { id: conversation.id },
            data: {
                lastMessageAt: new Date(),
            },
        });

        // 5. Emit
        const room = `conversation-${conversation.id}`;
        this.messagesGateway.server.to(room).emit('newMessage', message);
        this.messagesGateway.server.to(`patient-${patientId}`).emit('newMessage', message);

        // 6. Trigger Workflow Input Event
        // Determine input type based on channel
        const inputType = message.channel === 'WHATSAPP' ? 'WHATSAPP' : 'SMS'; // Simplified mapping
        try {
            await this.workflowOrchestrator.triggerInputEvent(patientId, inputType, content);
        } catch (error) {
            console.error(`Failed to trigger workflow input event: ${error.message}`);
        }

        return message;
    }
}
