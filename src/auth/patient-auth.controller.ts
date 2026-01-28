
import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { PatientAuthService } from './patient-auth.service';

@Controller('patient/auth')
export class PatientAuthController {
    constructor(private authService: PatientAuthService) { }

    @Post('login')
    async login(@Body() body: { email: string; password: string }) {
        const patient = await this.authService.validatePatient(body.email, body.password);
        if (!patient) {
            throw new UnauthorizedException('Invalid credentials');
        }
        return this.authService.login(patient);
    }
}
