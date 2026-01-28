
import { Module } from '@nestjs/common';
import { PatientAuthService } from './patient-auth.service';
import { PatientAuthController } from './patient-auth.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
    imports: [
        PrismaModule,
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => ({
                secret: configService.get<string>('JWT_SECRET') || 'secretKey',
                signOptions: { expiresIn: '60m' },
            }),
            inject: [ConfigService],
        }),
        ConfigModule
    ],
    controllers: [PatientAuthController],
    providers: [PatientAuthService],
    exports: [PatientAuthService, JwtModule]
})
export class PatientAuthModule { }
