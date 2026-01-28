
import { Controller, Get, Post, Body, Query, HttpException, HttpStatus } from '@nestjs/common';
import { WaitlistService } from './waitlist.service';

@Controller('waitlist')
export class WaitlistController {
    constructor(private waitlistService: WaitlistService) { }

    @Get('claim')
    async claimSlot(@Query('token') token: string) {
        if (!token) {
            throw new HttpException('Token is required', HttpStatus.BAD_REQUEST);
        }

        try {
            const result = await this.waitlistService.claimSlot(token);
            return result;
        } catch (error) {
            throw new HttpException(
                error.message || 'Failed to claim slot',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Post('manual-offer')
    async createManualOffer(@Body() body: { patientId: string, appointmentId?: string, doctorId?: string, date?: string }) {
        if (!body.patientId) {
            throw new HttpException('patientId is required', HttpStatus.BAD_REQUEST);
        }

        try {
            const dateObj = body.date ? new Date(body.date) : undefined;
            const result = await this.waitlistService.createManualOffer(body.patientId, body.appointmentId, body.doctorId, dateObj);
            return result;
        } catch (error) {
            throw new HttpException(
                error.message || 'Failed to create manual offer',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }
}
