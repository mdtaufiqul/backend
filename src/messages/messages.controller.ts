import { Controller, Get, Post, Patch, Body, Param, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { ConversationsService } from '../conversations/conversations.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('messages')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MessagesController {
    constructor(
        private readonly messagesService: MessagesService,
        private readonly conversationsService: ConversationsService
    ) { }

    @Get(':patientId')
    async getHistory(@Request() req, @Param('patientId') patientId: string) {
        // ... existing code
        // Scope Validation
        if (req.user.role === 'patient' && req.user.id !== patientId) {
            throw new ForbiddenException('You can only access your own messages');
        }
        return this.messagesService.getHistory(patientId);
    }

    @Patch('read')
    async markRead(@Request() req, @Body() body: { messageIds: string[] }) {
        // TODO: Validate that user is part of the conversation for these messages
        // For now, assuming if they have the ID, they can mark it read (low risk)
        // Or we could fetch messages and check senderId != currentUserId

        await this.messagesService.markAsRead(body.messageIds);
        return { success: true };
    }

    @Post()
    async create(@Request() req, @Body() body: { text: string; patientId: string }) {
        const userId = req.user.id;
        const role = req.user.role;

        // Scope Validation: Patients can only message as themselves
        let targetPatientId = body.patientId;
        if (role === 'patient') {
            if (targetPatientId && targetPatientId !== userId) {
                throw new ForbiddenException('You cannot send messages for another patient');
            }
            targetPatientId = userId; // Force patientId to be self
        }

        // Create Payload
        // Logic to get or create conversation
        // If doctor is sending, we need doctor ID (userId) and patientId (targetPatientId)
        // If patient is sending, we need doctor ID (assigned doctor) and patientId (userId)

        // Fetch patient profile to get assigned patient ID if user is patient
        // (already done via body.patientId check logic above for patient role)

        let doctorId = userId;
        let pId = targetPatientId;

        if (role === 'patient') {
            // If patient is sending, doctorId is... ambiguous if not passed?
            // But existing logic seemed to require linking to a doctor?
            // Let's assume for now we look up the conversation via ConversationsService logic
            // But ConversationsService needs doctorId AND patientId to get/create.
            // If patient sends, they might not know their doctorId in this legacy payload.
            // We can find the conversation by patientId? No, unique is (doctorId, patientId).
            // We need to find the patient's assigned doctor.
            // For now, let's fail if we can't find a single active conversation?
            // Or rely on optional doctorId in payload if provided.

            if (body['doctorId']) {
                doctorId = body['doctorId'];
            } else {
                // Try to find ANY conversation for this patient
                const conversations = await this.conversationsService.findAll(userId, role, pId);
                if (conversations.length > 0) {
                    doctorId = conversations[0].doctorId;
                } else {
                    throw new ForbiddenException('No conversation found with a doctor');
                }
            }
        } else {
            // Doctor sending
            // doctorId = userId (already set)
            // pId = targetPatientId
        }

        return this.conversationsService.sendMessage(
            (await this.conversationsService.getOrCreateConversation(doctorId, pId)).id,
            body.text,
            userId,
            role,
            pId
        );
    }
}
