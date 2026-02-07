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
    async findAll(
        @Request() req, 
        @Query('type') type?: 'INTERNAL' | 'VISITOR',
        @Query('patientId') patientIdQuery?: string,
        @Query('doctorId') doctorIdQuery?: string
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
                return []; // No profile, no conversations
            }
        }

        return this.conversationsService.findAll(userId, role, clinicId, patientId, type, patientIdQuery, doctorIdQuery);
    }

    /**
     * Create or retrieve a conversation
     */
    @Post()
    async create(@Request() req, @Body() body: { patientId?: string, doctorId?: string }) {
        const userId = req.user.userId;
        const role = req.user.role;
        const normalizedRole = role?.toUpperCase();

        // Allow Patients, Doctors and Admins/Staff to initiate conversations
        // (Patients can initiate with doctors)
        const allowedRoles = ['PATIENT', 'DOCTOR', 'SYSTEM_ADMIN', 'CLINIC_ADMIN', 'STAFF', 'NURSE'];
        if (!allowedRoles.includes(normalizedRole)) {
            throw new ForbiddenException('You are not authorized to initiate conversations');
        }

        // If patient is initiating, resolve their patient profile
        if (role === 'patient') {
            let patientId: string | undefined;
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

            const targetDoctorId = body.doctorId || (body as any).patientId;
            if (!targetDoctorId) {
                throw new ForbiddenException('Doctor ID is required for patients to start a conversation');
            }

            return this.conversationsService.getOrCreateConversation(targetDoctorId, patientId);
        }

        // If staff/doctor is initiating
        if (body.patientId) {
            return this.conversationsService.getOrCreateConversation(userId, body.patientId);
        } else if (body.doctorId) {
            // Staff to Staff chat - currently schema limited to showing for one side
            return this.conversationsService.getOrCreateConversation(body.doctorId, undefined);
        }

        throw new ForbiddenException('Participant ID (patient or doctor) required');
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
