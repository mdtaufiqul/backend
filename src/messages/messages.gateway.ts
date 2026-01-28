import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    ConnectedSocket,
    OnGatewayConnection,
    OnGatewayDisconnect,
    MessageBody
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Inject, forwardRef, Logger } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { PrismaService } from '../prisma/prisma.service';
import { ROLES, UserRole } from '../shared/constants/roles.constant';

@WebSocketGateway({
    cors: {
        origin: '*',
    },
})
export class MessagesGateway {
    private readonly logger = new Logger(MessagesGateway.name);

    @WebSocketServer()
    server: Server;

    constructor(
        @Inject(forwardRef(() => MessagesService))
        private readonly messagesService: any,
        private readonly prisma: PrismaService // Inject Prisma for Visitor lookup
    ) { }

    async handleConnection(client: Socket) {
        // 1. Check for standard JWT auth (Staff/Patients)
        const token = client.handshake.query.token as string;

        // 2. Check for Visitor Token
        const visitorToken = client.handshake.query.visitor_token as string;

        if (visitorToken) {
            const visitor = await this.prisma.visitor.findUnique({ where: { token: visitorToken } });
            if (visitor) {
                client.data.visitor = visitor;
                client.data.userType = ROLES.VISITOR;
                this.logger.log(`Visitor ${visitor.id} connected ${client.id}`);
                return;
            }
        }

        // Default JWT Logic (Simplified)
        if (token) {
            // Validate JWT...
            // client.data.user = user;
            // client.data.userType = 'USER' or 'PATIENT';
        }
    }

    @SubscribeMessage('joinRoom')
    handleJoinRoom(
        @MessageBody() data: { patientId: string },
        @ConnectedSocket() client: Socket,
    ) {
        const room = `patient-${data.patientId}`;
        client.join(room);
        this.logger.log(`Client ${client.id} joined room ${room}`);
        return { event: 'joinedRoom', room };
    }

    @SubscribeMessage('joinConversation')
    handleJoinConversation(
        @MessageBody() data: { conversationId: string },
        @ConnectedSocket() client: Socket,
    ) {
        const room = `conversation-${data.conversationId}`;
        client.join(room);
        this.logger.log(`Client ${client.id} joined conversation room ${room}`);
        return { event: 'joinedConversation', room };
    }

    @SubscribeMessage('sendMessage')
    async handleSendMessage(
        @MessageBody()
        data: {
            text: string;
            senderId?: string; // Optional for visitor
            senderType: UserRole;
            patientId?: string;
            visitorId?: string;
            conversationId?: string;
            doctorId?: string;
        },
        @ConnectedSocket() client: Socket
    ) {
        this.logger.log(`Received message from ${data.senderId || 'VISITOR'}`);

        // Save to DB
        // Create payload matching new signature
        // Create payload matching new signature
        const createPayload = {
            conversationId: data.conversationId || '',
            content: data.text,
            senderId: data.senderId,
            visitorId: client.data.visitor?.id, // Use validated visitor ID if available
            senderType: (client.data.userType === ROLES.VISITOR ? ROLES.VISITOR : data.senderType) as UserRole,
        };

        // Ensure conversationId exists
        if (!createPayload.conversationId && data.patientId && data.senderId) {
            // Fallback lookup could be done here but let's encourage client update
        }

        const message = await this.messagesService.create(createPayload);

        // Broadcast to patient room (legacy/primary)
        const patientRoom = `patient-${data.patientId}`;
        this.server.to(patientRoom).emit('newMessage', message);

        // Broadcast to conversation room (specific)
        if (createPayload.conversationId) {
            const conversationRoom = `conversation-${createPayload.conversationId}`;
            this.server.to(conversationRoom).emit('newMessage', message);
        }

        return message;
    }

    @SubscribeMessage('markAsRead')
    async handleMarkAsRead(
        @MessageBody() data: { messageIds: string[], conversationId: string },
        @ConnectedSocket() client: Socket
    ) {
        this.logger.log(`Marking messages as read for conversation ${data.conversationId}`);
        await this.messagesService.markAsRead(data.messageIds);
        return { success: true };
    }

    @SubscribeMessage('messageDelivered')
    async handleMessageDelivered(
        @MessageBody() data: { messageId: string, conversationId: string },
        @ConnectedSocket() client: Socket
    ) {
        await this.prisma.message.update({
            where: { id: data.messageId },
            data: { status: 'DELIVERED' }
        });

        const room = `conversation-${data.conversationId}`;
        this.server.to(room).emit('messageStatusUpdate', {
            messageId: data.messageId,
            status: 'DELIVERED',
            conversationId: data.conversationId
        });

        return { success: true };
    }
}
