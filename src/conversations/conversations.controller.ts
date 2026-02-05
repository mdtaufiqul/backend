import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    UseGuards,
    Request,
    ForbiddenException,
    Query,
} from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
    constructor(
        private readonly conversationsService: ConversationsService,
        private readonly prisma: PrismaService,
    ) { }

    /**
     * Get all conversations for the current user
     */
    @Get()
    async findAll(@Request() req, @Query('type') type?: 'INTERNAL' | 'VISITOR') {
        const userId = req.user.userId;
        const role = req.user.role;
        const clinicId = req.user.clinicId;

        // Get patient ID if user is a patient
        let patientId: string | undefined;
        if (role === 'patient') {
            // Optimized: If profileType matches, trusted userId is the patientId
            if (req.user.profileType === 'PATIENT') {
                patientId = userId;
            } else {
                const patient = await this.prisma.patient.findFirst({
                    where: { email: { equals: req.user.email, mode: 'insensitive' } },
                });
                patientId = patient?.id;
            }
            
            if (!patientId) {
                throw new ForbiddenException('Patient profile not found');
            }
        }

        return this.conversationsService.findAll(userId, role, clinicId, patientId, type);
    }

    /**
     * Create or retrieve a conversation
     */
    @Post()
    async create(@Request() req, @Body() body: { patientId: string }) {
        const userId = req.user.userId;
        const role = req.user.role;
        const normalizedRole = role?.toUpperCase();

        // Allow Doctors and Admins/Staff to initiate conversations
        const allowedRoles = ['DOCTOR', 'SYSTEM_ADMIN', 'CLINIC_ADMIN', 'STAFF', 'NURSE'];
        if (!allowedRoles.includes(normalizedRole)) {
            throw new ForbiddenException('You are not authorized to initiate conversations');
        }

        // Ideally pass role/clinicId to service to ensure data isolation context is maintained
        return this.conversationsService.getOrCreateConversation(userId, body.patientId);
    }

    /**
     * Get a specific conversation
     */
    @Get(':id')
    async findOne(@Param('id') id: string, @Request() req) {
        const userId = req.user.userId;
        const role = req.user.role;
        const clinicId = req.user.clinicId;

        // Get patient ID if user is a patient
        let patientId: string | undefined;
        if (role === 'patient') {
            if (req.user.profileType === 'PATIENT') {
                patientId = userId;
            } else {
                const patient = await this.prisma.patient.findFirst({
                    where: { email: { equals: req.user.email, mode: 'insensitive' } },
                });
                patientId = patient?.id;
            }
            
            if (!patientId) {
                throw new ForbiddenException('Patient profile not found');
            }
        }

        return this.conversationsService.findOne(id, userId, role, clinicId, patientId);
    }

    /**
     * Get messages for a conversation
     */
    @Get(':id/messages')
    async getMessages(@Param('id') id: string, @Request() req) {
        const userId = req.user.userId;
        const role = req.user.role;
        const clinicId = req.user.clinicId;

        // Get patient ID if user is a patient
        let patientId: string | undefined;
        if (role === 'patient') {
            if (req.user.profileType === 'PATIENT') {
                patientId = userId;
            } else {
                const patient = await this.prisma.patient.findFirst({
                    where: { email: { equals: req.user.email, mode: 'insensitive' } },
                });
                patientId = patient?.id;
            }
            
            if (!patientId) {
                throw new ForbiddenException('Patient profile not found');
            }
        }

        return this.conversationsService.getMessages(id, userId, role, clinicId, patientId);
    }

    /**
     * Send a message in a conversation
     */
    @Post(':id/messages')
    async sendMessage(
        @Param('id') id: string,
        @Body() body: { content: string },
        @Request() req,
    ) {
        const userId = req.user.userId;
        const role = req.user.role;
        const clinicId = req.user.clinicId;

        // Get patient ID if user is a patient
        let patientId: string | undefined;
        if (role === 'patient') {
            if (req.user.profileType === 'PATIENT') {
                patientId = userId;
            } else {
                const patient = await this.prisma.patient.findFirst({
                    where: { email: { equals: req.user.email, mode: 'insensitive' } },
                });
                patientId = patient?.id;
            }
            
            if (!patientId) {
                throw new ForbiddenException('Patient profile not found');
            }
        }

        return this.conversationsService.sendMessage(
            id,
            body.content,
            userId,
            role,
            clinicId,
            patientId,
            (body as any).onBehalfOfId
        );
    }
}
