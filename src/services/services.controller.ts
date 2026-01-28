import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, Query } from '@nestjs/common';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Public } from '../common/public.decorator';
import { ROLES } from '../shared/constants/roles.constant';

@Controller('services')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) { }

  @Post()
  @Permissions('manage_own_config') // Updated to allow doctors
  create(@Req() req: any, @Body() createServiceDto: CreateServiceDto) {
    return this.servicesService.create({
      ...createServiceDto,
      clinicId: createServiceDto.clinicId || req.user.clinicId,
      doctorId: createServiceDto.doctorId || (req.user.role === ROLES.DOCTOR ? req.user.id : undefined)
    });
  }

  @Get()
  // @Permissions('view_clinic_info') - Allowed for all authenticated users (scoped by code)
  findAll(
    @Req() req: any,
    @Query('clinicId') clinicId?: string,
    @Query('doctorId') doctorId?: string
  ) {
    let targetClinicId = clinicId || req.user.clinicId;
    let targetDoctorId = doctorId;

    // RULE 1: If user is DOCTOR, strict scoping rules.
    if (req.user.role === ROLES.DOCTOR) {
      targetClinicId = req.user.clinicId; // Always enforce own clinic

      // Relaxed Scoping: 
      // If a specific doctorId is requested (e.g. for booking form), allow it.
      // IF NOT, default to their own ID to show "My Services".
      if (!doctorId) {
        targetDoctorId = req.user.id;
      } else {
        // Optionally verify the target doctor belongs to same clinic? 
        // For now, assuming standard clinic-scope filter downstream handles it.
        targetDoctorId = doctorId;
      }
    }

    // Strict Scoping: Ensure non-global-admins only see their own clinic
    const isGlobalAdmin = req.user.role === ROLES.SYSTEM_ADMIN && !req.user.clinicId;
    if (!isGlobalAdmin && !req.user.permissions?.view_all_clinics) {
      targetClinicId = req.user.clinicId;
    }

    // RULE 2: "No service table query returns data without doctorId filter"
    // RELAXED: If we are an Admin (not DOCTOR) and have a clinicId, we should return all services.
    if (!targetDoctorId && req.user.role === ROLES.DOCTOR) {
      return [];
    }

    // If not a doctor, and we have a clinicId, we proceed.
    // If no clinicId and no doctorId (and not global admin), the service will return [] or error anyway based on its strict scoping.

    return this.servicesService.findAll(targetClinicId, targetDoctorId);
  }

  @Public() // Allow public access for booking form to fetch service details
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.servicesService.findOne(id);
  }

  @Patch(':id')
  @Permissions('manage_own_config')
  update(@Param('id') id: string, @Body() updateServiceDto: UpdateServiceDto) {
    return this.servicesService.update(id, updateServiceDto);
  }

  @Delete(':id')
  @Permissions('manage_own_config')
  remove(@Param('id') id: string) {
    return this.servicesService.remove(id);
  }
}
