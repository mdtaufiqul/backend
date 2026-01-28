import { Controller, Post, Body, Get, Query, Patch, BadRequestException } from '@nestjs/common';
import { ChatWidgetService } from './chat-widget.service';
import { Public } from '../common/public.decorator';

@Controller('widget')
@Public() // All widget endpoints are public (secured by visitor token)
export class ChatWidgetController {
    constructor(private readonly chatWidgetService: ChatWidgetService) { }

    @Post('init')
    async initSession(@Body() body: { clinicId: string; token?: string }) {
        if (!body.clinicId) throw new BadRequestException('Clinic ID is required');
        return this.chatWidgetService.initSession(body.clinicId, body.token);
    }

    @Post('verify')
    async verifySession(@Body() body: { token: string }) {
        const visitor = await this.chatWidgetService.getVisitorByToken(body.token);
        if (!visitor) {
            return { valid: false };
        }
        return { valid: true, visitor };
    }

    @Patch('profile')
    async updateProfile(@Body() body: { token: string; name?: string; email?: string; phone?: string }) {
        const visitor = await this.chatWidgetService.getVisitorByToken(body.token);
        if (!visitor) throw new BadRequestException('Invalid token');

        return this.chatWidgetService.updateProfile(body.token, {
            name: body.name,
            email: body.email,
            phone: body.phone
        });
    }

    @Patch('messages/read')
    async markMessagesAsRead(@Body() body: { token: string; messageIds: string[] }) {
        const visitor = await this.chatWidgetService.getVisitorByToken(body.token);
        if (!visitor) throw new BadRequestException('Invalid token');

        return this.chatWidgetService.markAsRead(body.messageIds);
    }
}
