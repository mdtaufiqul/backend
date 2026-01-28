import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class EmailTokensService {
    constructor(private prisma: PrismaService) { }

    /**
     * Generate a secure, single-use token for a specific action
     */
    async generateToken(appointmentId: string, action: 'CONFIRM' | 'CANCEL' | 'RESCHEDULE' | 'CALENDAR', expiresInHours = 48) {
        // Generate secure random token
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + expiresInHours);

        const emailToken = await this.prisma.emailToken.create({
            data: {
                token,
                appointmentId,
                action,
                expiresAt,
            },
        });

        return emailToken.token;
    }

    /**
     * Validate a token without consuming it (for rendering page)
     */
    async validateToken(token: string) {
        const emailToken = await this.prisma.emailToken.findUnique({
            where: { token },
            include: {
                appointment: {
                    include: {
                        patient: true,
                        doctor: true,
                        service: true,
                        clinic: true
                    }
                }
            }
        });

        if (!emailToken) {
            throw new NotFoundException('Invalid token');
        }

        // CALENDAR tokens are reusable, so we skip the usedAt check
        if (emailToken.action !== 'CALENDAR' && emailToken.usedAt) {
            throw new BadRequestException('Token already used');
        }

        if (new Date() > emailToken.expiresAt) {
            throw new BadRequestException('Token expired');
        }

        return emailToken;
    }

    /**
     * Consume a token (mark as used)
     */
    async consumeToken(token: string) {
        // Validation included
        await this.validateToken(token);

        return this.prisma.emailToken.update({
            where: { token },
            data: {
                usedAt: new Date(),
            },
        });
    }
}
