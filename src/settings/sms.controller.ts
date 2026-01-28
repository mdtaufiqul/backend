import { Controller, Get, Post, Body, UseGuards, Request, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/encryption.service';
import { TwilioService } from '../services/twilio.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@Controller('settings/sms')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SmsController {
    constructor(
        private prisma: PrismaService,
        private encryptionService: EncryptionService,
        private twilioService: TwilioService
    ) { }

    @Get()
    @Permissions('manage_own_config')
    async getConfig(@Request() req: any) {
        const userId = req.user.userId;

        const config = await this.prisma.doctorSmsConfig.findUnique({
            where: { userId }
        });

        if (!config) return {};

        return {
            accountSid: config.accountSid,
            phoneNumber: config.phoneNumber,
            whatsappNumber: config.whatsappNumber,
            hasAuthToken: true // Mask token
        };
    }

    @Post()
    @Permissions('manage_own_config')
    async saveConfig(@Request() req: any, @Body() body: any) {
        const userId = req.user.userId;

        const accountSid = body.accountSid?.trim();
        const authToken = body.authToken?.trim();
        const phoneNumber = body.phoneNumber?.trim();
        const whatsappNumber = body.whatsappNumber?.trim();

        // Encrypt Auth Token if provided
        let content = '';
        let iv = '';
        if (authToken) {
            const encrypted = this.encryptionService.encrypt(authToken);
            content = encrypted.content;
            iv = encrypted.iv;
        }

        const data: any = {
            accountSid,
            phoneNumber,
            whatsappNumber
        };

        if (content && iv) {
            data.authTokenEncrypted = content;
            data.iv = iv;
        }

        // Upsert
        return this.prisma.doctorSmsConfig.upsert({
            where: { userId },
            update: data,
            create: {
                userId,
                accountSid,
                authTokenEncrypted: content || '',
                iv: iv || '',
                phoneNumber,
                whatsappNumber
            }
        });
    }

    @Post('test')
    @Permissions('manage_own_config')
    async testConnection(@Request() req: any) {
        const userId = req.user.userId;
        return this.twilioService.verifyConnection(userId);
    }
}
