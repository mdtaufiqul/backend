import { Controller, Get, Param, Post, Body, UseGuards, Req, Query, Delete } from '@nestjs/common';
import { Public } from '../common/public.decorator';
import { PatientsService } from './patients.service';
import { Patient } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@Controller('patients')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PatientsController {
    constructor(private readonly patientsService: PatientsService) { }

    @Get()
    @Permissions('view_patients')
    async findAll(@Req() req: any, @Query('search') search?: string): Promise<Patient[]> {
        const user = req.user;
        // Pass full user object to service for role-based filtering (e.g. Doctor sees only their own patients)
        return this.patientsService.findAll(user, search);
    }

    @Get(':id')
    @Permissions('view_patients')
    async findOne(@Param('id') id: string, @Req() req: any): Promise<Patient | null> {
        return this.patientsService.findOne(id, req.user);
    }

    @Post()
    @Permissions('manage_patients')
    async create(@Body() createPatientDto: any, @Req() req: any): Promise<Patient> {
        return this.patientsService.create(createPatientDto, req.user);
    }

    @Get(':id/logs')
    @Permissions('view_patients')
    async getLogs(@Param('id') id: string, @Req() req: any) {
        return this.patientsService.getCommunicationLogs(id, req.user);
    }

    @Get('check-email/:email')
    async checkEmail(@Param('email') email: string, @Query('clinicId') clinicId?: string) {
        return this.patientsService.checkEmailExists(email, clinicId);
    }

    @Post(':id/notes')
    @Permissions('manage_patients')
    async addNote(@Param('id') id: string, @Body('content') content: string, @Req() req: any) {
        return this.patientsService.addNote(id, content, req.user);
    }

    @Post(':id/files')
    @Permissions('manage_patients')
    async addFile(@Param('id') id: string, @Body() fileData: any, @Req() req: any) {
        return this.patientsService.addFile(id, fileData, req.user);
    }

    @Delete(':id')
    @Permissions('manage_patients')
    async remove(@Param('id') id: string, @Req() req: any) {
        return this.patientsService.remove(id, req.user);
    }
}
