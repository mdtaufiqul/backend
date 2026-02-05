
import { Controller, Get, Post, Body, Param, Query, HttpException, HttpStatus, UseGuards, Request } from '@nestjs/common';
import { CommunicationService } from './communication.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('communication')
@UseGuards(JwtAuthGuard)
export class CommunicationController {
    constructor(private communicationService: CommunicationService) { }

    @Get('history/:patientId')
    async getPatientHistory(@Param('patientId') patientId: string) {
        return this.communicationService.getPatientHistory(patientId);
    }

    @Post('send')
    async sendManualMessage(@Request() req, @Body() body: {
        doctorId: string;
        patientId: string;
        type: 'SMS' | 'WHATSAPP' | 'EMAIL' | 'IN_APP';
        content: string;
    }) {
        try {
            await this.communicationService.sendManualMessage(
                body.doctorId,
                body.patientId,
                body.type,
                body.content,
                req.user
            );
            return { status: 'success' };
        } catch (error) {
            console.error('[CommunicationController] Error:', error.message);
            throw new HttpException(error.message, error.status || HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
