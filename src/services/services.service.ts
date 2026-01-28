import { Injectable } from '@nestjs/common';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) { }

  create(createServiceDto: CreateServiceDto) {
    return this.prisma.service.create({
      data: createServiceDto
    });
  }

  findAll(clinicId?: string, doctorId?: string) {
    if (!clinicId) {
      return []; // Strict scoping
    }
    const where: any = { clinicId };

    // Strict filtering: If doctorId is provided, use it.
    // If NOT provided, the controller returns [], but if we get here with logic changes later:
    if (doctorId) {
      where.doctorId = doctorId;
    } else {
      // Fallback: If for some reason we query without doctorId despite Controller checks,
      // we should ensure we don't accidentally return "Shared" services unless intended.
      // Assuming Services MUST belong to a doctor per requirement "Ensure every record includes doctorId".
      // We can mandate doctorId is not null if we want to be super strict.
      // where.doctorId = { not: null }; // or however Prisma handles "Has value"
    }

    return this.prisma.service.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });
  }

  findOne(id: string) {
    return this.prisma.service.findUnique({
      where: { id }
    });
  }

  update(id: string, updateServiceDto: UpdateServiceDto) {
    return this.prisma.service.update({
      where: { id },
      data: updateServiceDto
    });
  }

  remove(id: string) {
    return this.prisma.service.delete({
      where: { id }
    });
  }
}
