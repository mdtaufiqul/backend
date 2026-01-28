import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MessagesGateway } from './messages.gateway';
import { ROLES, UserRole } from '../shared/constants/roles.constant';

@Injectable()
export class MessagesService {
    constructor(
        private prisma: PrismaService,
        @Inject(forwardRef(() => MessagesGateway))
        private messagesGateway: any
    ) { }

    // DEPRECATED: Use ConversationsService instead
    async create(data: {
        conversationId: string;
        content: string;
        senderId?: string; // Null if visitor
        visitorId?: string; // NEW: If visitor
        senderType: UserRole;
    }) {
        const message = await this.prisma.message.create({
            data: {
                conversationId: data.conversationId,
                content: data.content,
                senderId: data.senderId,
                visitorId: data.visitorId,
                senderType: data.senderType,
            },
        });

        // Broadcast Real-time
        const room = `conversation-${data.conversationId}`;
        this.messagesGateway.server.to(room).emit('newMessage', message);

        // Also broadcast to staff room if this is a visitor message?
        // Logic handled in Gateway or here via clinicId lookup if needed.

        return message;
    }

    async getHistory(conversationId: string) {
        return this.prisma.message.findMany({
            where: { conversationId },
            orderBy: { createdAt: 'asc' },
        });
    }

    async getRecentConversations() {
        // DEPRECATED: Use ConversationsService.findAll instead
        return [];
    }

    async markAsRead(messageIds: string[]) {
        if (!messageIds.length) return;

        // Update DB
        const now = new Date();
        await this.prisma.message.updateMany({
            where: {
                id: { in: messageIds },
                readAt: null
            },
            data: {
                readAt: now,
                status: 'READ'
            }
        });

        // Get conversation ID for broadcasting
        const message = await this.prisma.message.findFirst({
            where: { id: { in: messageIds } },
            select: { conversationId: true }
        });

        if (message) {
            const room = `conversation-${message.conversationId}`;
            this.messagesGateway.server.to(room).emit('messagesRead', {
                messageIds,
                readAt: now,
                status: 'READ',
                conversationId: message.conversationId
            });
        }
    }
}
