import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { FormsService } from './forms.service';
import { CreateFormDto } from './dto/create-form.dto';
import { UpdateFormDto } from './dto/update-form.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Public } from '../common/public.decorator';

@Controller('forms')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class FormsController {
  constructor(private readonly formsService: FormsService) { }

  @Post()
  @Permissions('manage_clinic')
  create(@Body() createFormDto: CreateFormDto) {
    return this.formsService.create(createFormDto);
  }

  @Get()
  @Permissions('view_clinic_info')
  findAll() {
    return this.formsService.findAll();
  }

  @Get(':id')
  @Public() // Allow public access to fetch form config for filling
  findOne(@Param('id') id: string) {
    console.log(`GET /forms/${id} requested`);
    return this.formsService.findOne(id);
  }

  @Patch(':id')
  @Permissions('manage_clinic')
  update(@Param('id') id: string, @Body() updateFormDto: UpdateFormDto) {
    return this.formsService.update(id, updateFormDto);
  }

  @Get('default/active')
  @Public()
  findDefault() {
    return this.formsService.findDefault();
  }

  @Post(':id/default')
  @Permissions('manage_clinic')
  setDefault(@Param('id') id: string) {
    return this.formsService.setDefault(id);
  }

  @Delete(':id')
  @Permissions('manage_clinic')
  remove(@Param('id') id: string) {
    return this.formsService.remove(id);
  }

  @Post(':id/submissions')
  @Public() // Allow patients to submit forms without logging in
  submit(@Param('id') id: string, @Body() submissionData: any, @Body('sessionToken') sessionToken?: string) {
    return this.formsService.submit(id, submissionData, sessionToken);
  }

  @Get(':id/submissions')
  @Permissions('view_patients')
  getSubmissions(@Param('id') id: string) {
    return this.formsService.getSubmissions(id);
  }
}
