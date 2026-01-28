import { Controller, Get, Post, Body, Param, HttpException, HttpStatus, UseGuards } from '@nestjs/common';
import { FormsService } from './forms.service';
import { Public } from '../common/public.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@Controller('forms/intake-session')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class IntakeController {
    constructor(private readonly formsService: FormsService) { }

    @Post()
    @Permissions('manage_appointments')
    async createSession(@Body() body: { patientId: string, appointmentId?: string }) {
        if (!body.patientId) {
            throw new HttpException('patientId is required', HttpStatus.BAD_REQUEST);
        }
        return this.formsService.createIntakeSession(body.patientId, body.appointmentId);
    }

    @Get(':token')
    @Public()
    async getSession(@Param('token') token: string) {
        const result = await this.formsService.getIntakeSession(token);
        if (!result) {
            throw new HttpException('Invalid or expired token', HttpStatus.NOT_FOUND);
        }
        return result;
    }
}
