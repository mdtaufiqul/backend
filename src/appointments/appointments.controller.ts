import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Request, UseGuards, ForbiddenException } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Public } from '../common/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller('appointments')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AppointmentsController {
  constructor(
    private readonly appointmentsService: AppointmentsService,
    private readonly prisma: PrismaService
  ) { }

  @Post()
  @Permissions('manage_appointments')
  async create(@Body() createAppointmentDto: CreateAppointmentDto) {
    try {
      return await this.appointmentsService.create(createAppointmentDto);
    } catch (error) {
      console.error('Controller caught error:', error);
      throw error;
    }
  }

  @Get()
  @Permissions('view_appointments')
  async findAll(
    @Request() req,
    @Query('doctorId') doctorId?: string,
    @Query('patientId') patientIdParam?: string,
    @Query('date') date?: string,
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('timezone') timezone?: string
  ) {
    const userId = req.user.userId;
    const role = req.user.role?.toLowerCase();
    const clinicId = req.user.clinicId;

    // Determine effective patientId filter
    let patientId: string | null = patientIdParam || null;

    // SECURITY: If user is a patient, FORCE patientId to their own ID
    if (role === 'patient') {
      const patient = await this.prisma.patient.findFirst({
        where: { email: { equals: req.user.email, mode: 'insensitive' } }
      });
      if (!patient) {
        throw new ForbiddenException('Patient profile not found');
      }
      patientId = patient.id;
    }

    return this.appointmentsService.findAll({
      userId,
      role,
      patientId,
      doctorId,
      date,
      start,
      end,
      timezone,
      clinicId
    });
  }

  @Get('available-slots')
  @Public()
  async getAvailableSlots(
    @Query('doctorId') doctorId: string,
    @Query('date') date: string,
    @Query('type') type?: 'online' | 'in-person',
    @Query('excludeId') excludeId?: string,
    @Query('timezone') timezone?: string
  ) {
    return this.appointmentsService.getAvailableSlots({
      doctorId,
      date,
      type,
      excludeId,
      timezone
    });
  }

  @Get('waitlist/all')
  @Permissions('manage_appointments')
  async getWaitlist(@Request() req) {
    return this.appointmentsService.getWaitlistAppointments(req.user);
  }

  @Get('waitlist/count')
  @Permissions('view_appointments')
  async getWaitlistCount(@Request() req) {
    return this.appointmentsService.getWaitlistCount(req.user);
  }

  @Get(':id')
  @Permissions('view_appointments')
  findOne(@Param('id') id: string, @Request() req) {
    return this.appointmentsService.findOne(id, req.user);
  }

  @Get(':id/meeting-url')
  @Permissions('view_appointments')
  getMeetingUrl(@Param('id') id: string, @Request() req) {
    return this.appointmentsService.getMeetingUrl(id, req.user);
  }

  @Patch(':id')
  @Permissions('manage_appointments')
  update(@Param('id') id: string, @Body() updateAppointmentDto: UpdateAppointmentDto, @Request() req) {
    return this.appointmentsService.update(id, updateAppointmentDto, req.user);
  }

  @Patch(':id/activate')
  @Permissions('manage_appointments')
  moveToActive(@Param('id') id: string, @Body() body: { date: string }, @Request() req) {
    return this.appointmentsService.moveToActiveSchedule(id, new Date(body.date), req.user);
  }

  @Patch(':id/priority')
  @Permissions('manage_appointments')
  updatePriority(@Param('id') id: string, @Body() body: { priority: number }, @Request() req) {
    return this.appointmentsService.updateWaitlistPriority(id, body.priority, req.user);
  }

  @Delete(':id')
  @Permissions('manage_appointments')
  remove(@Param('id') id: string, @Request() req) {
    return this.appointmentsService.remove(id, req.user);
  }
}
