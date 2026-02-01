
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class PatientAuthService {
    constructor(
        private prisma: PrismaService,
        private jwtService: JwtService
    ) { }

    async validatePatient(email: string, pass: string): Promise<any> {
        const patient = await this.prisma.patient.findFirst({
            where: { email: { equals: email, mode: 'insensitive' } }
        });

        if (patient && patient.passwordHash && await bcrypt.compare(pass, patient.passwordHash)) {
            const { passwordHash, ...result } = patient;
            return result;
        }
        return null;
    }

    async login(patient: any) {
        // Include userId in payload for compatibility with JwtAuthGuard
        const payload = { 
            email: patient.email, 
            sub: patient.id, 
            userId: patient.id, 
            role: 'patient',
            profileType: 'PATIENT'
        };
        return {
            access_token: this.jwtService.sign(payload),
            patient: {
                id: patient.id,
                name: patient.name,
                email: patient.email,
                doctorId: patient.assignedDoctorId,
                clinicId: patient.clinicId
            }
        };
    }
}
