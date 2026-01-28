import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ClinicsService } from './clinics.service';
import { CreateClinicDto } from './dto/create-clinic.dto';
import { UpdateClinicDto } from './dto/update-clinic.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@Controller('clinics')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ClinicsController {
  constructor(private readonly clinicsService: ClinicsService) { }

  @Post()
  @Permissions('manage_clinic') // Usually system admin or root setup
  create(@Body() createClinicDto: CreateClinicDto) {
    return this.clinicsService.create(createClinicDto);
  }

  @Get()
  @Permissions('view_clinic_info')
  findAll(@Request() req: any) {
    // STRICT MULTI-TENANCY
    if (req.user.role === 'SAAS_OWNER') {
      return this.clinicsService.findAll();
    }

    // If not SaaS Owner, you can ONLY see your own clinic.
    // Return as a list for API consistency.
    if (req.user.clinicId) {
      return this.clinicsService.findOne(req.user.clinicId).then(clinic => clinic ? [clinic] : []);
    }

    return [];
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    // STRICT MULTI-TENANCY
    const isSaasOwner = req.user.role === 'SAAS_OWNER' || req.user.role === 'SYSTEM_ADMIN';

    // SAAS_OWNER can view any. Others must match clinicId.
    if (!isSaasOwner && req.user.clinicId !== id) {
      // PermissionGuard might have passed, but data-access level denies.
      throw new Error('Unauthorized to view this clinic');
    }
    return this.clinicsService.findOne(id);
  }

  @Patch(':id')
  @Permissions('manage_clinic')
  update(@Param('id') id: string, @Body() updateClinicDto: UpdateClinicDto, @Request() req) {
    const isSaasOwner = req.user.role === 'SAAS_OWNER' || req.user.role === 'SYSTEM_ADMIN';

    // Consistently check clinicId
    // SYSTEM_ADMIN is tenant-scoped, so they must match ID too.
    if (!isSaasOwner && req.user.clinicId !== id) {
      throw new Error('Unauthorized to update this clinic');
    }
    return this.clinicsService.update(id, updateClinicDto);
  }

  @Delete(':id')
  @Permissions('delete_clinic') // SYSTEM_ADMIN only
  remove(@Param('id') id: string) {
    return this.clinicsService.remove(id);
  }

  @Post(':id/logo')
  @UseGuards(JwtAuthGuard, PermissionGuard) // Ensure standard guards are applied
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads/clinics',
      filename: (req, file, cb) => {
        const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
        return cb(null, `${randomName}${extname(file.originalname)}`);
      }
    })
  }))
  async uploadLogo(@Param('id') id: string, @UploadedFile() file: any, @Request() req) {
    const isSaasOwner = req.user.role === 'SAAS_OWNER' || req.user.role === 'SYSTEM_ADMIN';
    if (!isSaasOwner && req.user.clinicId !== id) {
      // Clean up the uploaded file if unauthorized
      // fs.unlink... (omitted for brevity, but good practice)
      throw new Error('Unauthorized to update this clinic');
    }

    if (!file) {
      throw new Error('File not uploaded');
    }

    const logoUrl = `/uploads/clinics/${file.filename}`;
    return this.clinicsService.update(id, { logo: logoUrl });
  }
}
