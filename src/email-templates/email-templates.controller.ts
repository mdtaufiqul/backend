import { Controller, Get, Post, Body, Patch, Param, Delete, Request, UseGuards, Query } from '@nestjs/common';
import { EmailTemplatesService } from './email-templates.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@Controller('email-templates')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class EmailTemplatesController {
    constructor(private readonly emailTemplatesService: EmailTemplatesService) { }

    @Post()
    @Permissions('manage_workflows')
    create(@Body() createDto: any, @Request() req) {
        const clinicId = req.user.clinicId;
        return this.emailTemplatesService.create({ ...createDto, clinicId });
    }

    @Get()
    @Permissions('view_workflows')
    findAll(@Request() req, @Query('clinicId') clinicId?: string) {
        return this.emailTemplatesService.findAll(req.user, clinicId);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.emailTemplatesService.findOne(id);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() updateDto: any) {
        return this.emailTemplatesService.update(id, updateDto);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.emailTemplatesService.remove(id);
    }

    @Post('seed')
    async seedTemplates(@Request() req: any) {
        const clinicId = req.user.clinicId;
        await this.emailTemplatesService.seedSystemTemplates(clinicId);
        return { message: 'System templates seeded successfully' };
    }
}
