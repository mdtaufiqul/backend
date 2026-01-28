
import { Controller, Post, Body, Get, Param, Query, UseGuards } from '@nestjs/common';
import { IntakeService } from './intake.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('intake')
export class IntakeController {
    constructor(private readonly intakeService: IntakeService) { }

    @Get('session')
    async getSession(@Query('token') token: string) {
        return this.intakeService.getSessionByToken(token);
    }

    @Post('start')
    @UseGuards(JwtAuthGuard)
    async startSession(@Body() body: { appointmentId: string }) {
        // Internal use or triggered by workflow
        return this.intakeService.createSession(body.appointmentId);
    }

    @Post('chat')
    async chat(@Body() body: { token: string; content: string }) {
        return this.intakeService.handleMessage(body.token, body.content);
    }

    @Post('finish')
    async finish(@Body() body: { token: string }) {
        return this.intakeService.finalizeSession(body.token);
    }
}
