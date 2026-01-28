import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Visitor } from '@prisma/client';
import * as crypto from 'crypto';

import { MessagesService } from '../messages/messages.service';

@Injectable()
export class ChatWidgetService {
    constructor(
        private prisma: PrismaService,
        private messagesService: MessagesService
    ) { }

    /**
     * Initialize a visitor session.
     * Use existing token if provided, otherwise create new.
     */
    async initSession(clinicId: string, token?: string): Promise<{ visitor: Visitor, isNew: boolean }> {
        if (token) {
            const existing = await this.prisma.visitor.findUnique({
                where: { token }
            });

            if (existing) {
                // If existing visitor, update last active or similar if needed
                return { visitor: existing, isNew: false };
            }
        }

        // Create New Visitor
        const newToken = crypto.randomBytes(32).toString('hex');
        const visitor = await this.prisma.visitor.create({
            data: {
                token: newToken,
                clinicId,
                email: null,
                name: 'Anonymous Visitor',
            }
        });

        return { visitor, isNew: true };
    }

    /**
     * Get Visitor by Token
     */
    async getVisitorByToken(token: string) {
        return this.prisma.visitor.findUnique({
            where: { token }
        });
    }

    /**
     * Update Visitor Profile (e.g. when they provide email)
     */
    async updateProfile(token: string, data: { name?: string; email?: string; phone?: string }) {
        return this.prisma.visitor.update({
            where: { token },
            data: {
                ...data
            }
        });
    }

    async markAsRead(messageIds: string[]) {
        return this.messagesService.markAsRead(messageIds);
    }
}
