
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../services/ai.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class IntakeService {
    constructor(
        private prisma: PrismaService,
        private aiService: AiService
    ) { }

    async createSession(appointmentId: string) {
        // Check if session exists
        const existing = await this.prisma.intakeSession.findUnique({
            where: { appointmentId }
        });
        if (existing) return existing;

        const token = uuidv4();
        return this.prisma.intakeSession.create({
            data: {
                appointmentId,
                token,
                status: 'OPEN',
                messages: []
            }
        });
    }

    async getSessionByToken(token: string) {
        const session = await this.prisma.intakeSession.findUnique({
            where: { token },
            include: { appointment: { include: { patient: true } } }
        });
        if (!session) throw new NotFoundException('Invalid intake token');
        return session;
    }

    async handleMessage(token: string, content: string) {
        const session = await this.getSessionByToken(token);

        if (session.status !== 'OPEN') {
            throw new BadRequestException('Session is closed');
        }

        const messages = session.messages as any[]; // Safe cast

        // User Message
        messages.push({ role: 'user', content, timestamp: new Date() });

        // AI Response
        // Construct simplified history for AI
        const history = messages.map(m => ({ role: m.role, content: m.content }));
        const aiResponseContent = await this.aiService.chat(history, `Patient Name: ${session.appointment?.patient?.name || 'Unknown'}`);

        messages.push({ role: 'assistant', content: aiResponseContent, timestamp: new Date() });

        return this.prisma.intakeSession.update({
            where: { id: session.id },
            data: { messages }
        });
    }

    async finalizeSession(token: string) {
        const session = await this.getSessionByToken(token);
        const messages = session.messages as any[];

        const summary = await this.aiService.summarize(messages);

        // Update Session
        await this.prisma.intakeSession.update({
            where: { id: session.id },
            data: { status: 'COMPLETED', summary }
        });

        // Update Appointment Notes (Append)
        if (session.appointmentId) {
            const appt = await this.prisma.appointment.findUnique({ where: { id: session.appointmentId } });
            const newNotes = (appt?.notes || '') + `\n\n[AI INTAKE SUMMARY]\n${summary}`;

            await this.prisma.appointment.update({
                where: { id: session.appointmentId },
                data: { notes: newNotes }
            });
        }

        return { summary };
    }
}
