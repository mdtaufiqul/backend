import { Injectable } from '@nestjs/common';
import { CreateClinicDto } from './dto/create-clinic.dto';
import { UpdateClinicDto } from './dto/update-clinic.dto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailTemplatesService } from '../email-templates/email-templates.service';

@Injectable()
export class ClinicsService {
  constructor(
    private prisma: PrismaService,
    private emailTemplatesService: EmailTemplatesService
  ) { }

  async create(createClinicDto: CreateClinicDto) {
    const clinic = await this.prisma.clinic.create({
      data: createClinicDto,
    });

    // Seed system email templates for the new clinic
    try {
      await this.emailTemplatesService.seedSystemTemplates(clinic.id);
      console.log(`[ClinicsService] Seeded email templates for clinic: ${clinic.id}`);
    } catch (error) {
      console.error(`[ClinicsService] Failed to seed email templates:`, error);
      // Don't block clinic creation if template seeding fails
    }

    return clinic;
  }

  findAll() {
    return this.prisma.clinic.findMany({
      orderBy: { updatedAt: 'desc' }
    });
  }

  findOne(id: string) {
    return this.prisma.clinic.findUnique({
      where: { id },
    });
  }

  update(id: string, updateClinicDto: UpdateClinicDto) {
    return this.prisma.clinic.update({
      where: { id },
      data: updateClinicDto,
    });
  }

  remove(id: string) {
    return this.prisma.clinic.delete({
      where: { id },
    });
  }
}
