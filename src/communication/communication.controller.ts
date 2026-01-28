
import { Controller, Get, Post, Body, Param, Query, HttpException, HttpStatus } from '@nestjs/common';
import { CommunicationService } from './communication.service';

@Controller('communication')
export class CommunicationController {
    constructor(private communicationService: CommunicationService) { }

    @Get('history/:patientId')
    async getPatientHistory(@Param('patientId') patientId: string) {
        return this.communicationService.getPatientHistory(patientId);
    }

    @Post('send')
    async sendManualMessage(@Body() body: {
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
                body.content
            );
            return { status: 'success' };
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
