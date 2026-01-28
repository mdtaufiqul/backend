import { Controller, Get, Post, Body, UseGuards, Request, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/encryption.service';
import { DynamicMailerService } from '../services/dynamic-mailer.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@Controller('settings/smtp')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SmtpController {
    constructor(
        private prisma: PrismaService,
        private encryptionService: EncryptionService,
        private mailerService: DynamicMailerService
    ) { }

    @Get()
    @Permissions('manage_own_config')
    async getConfig(@Request() req: any) {
        const userId = req.user.userId;

        const config = await this.prisma.doctorSmtpConfig.findUnique({
            where: { userId }
        });

        if (!config) return {};

        return {
            host: config.host,
            port: config.port,
            user: config.user,
            senderName: config.senderName,
            secure: config.secure,
            hasPassword: true, // Mask password
            systemEmail: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
        };
    }

    @Post()
    @Permissions('manage_own_config')
    async saveConfig(@Request() req: any, @Body() body: any) {
        const userId = req.user.userId;

        const { host, port, user: smtpUser, password, senderName } = body;

        // Encrypt Password
        let content = '';
        let iv = '';
        try {
            if (password) {
                const encrypted = this.encryptionService.encrypt(password);
                content = encrypted.content;
                iv = encrypted.iv;
            }
        } catch (e) {
            console.error('Encryption Error:', e);
            throw new HttpException('Encryption Failed', HttpStatus.INTERNAL_SERVER_ERROR);
        }

        const dataToUpdate: any = {
            host,
            port: parseInt(port),
            user: smtpUser,
            senderName,
            secure: parseInt(port) === 465
        };

        if (content && iv) {
            dataToUpdate.passwordEncrypted = content;
            dataToUpdate.iv = iv;
        }

        return this.prisma.doctorSmtpConfig.upsert({
            where: { userId: userId },
            update: dataToUpdate,
            create: {
                userId: userId,
                host,
                port: parseInt(port),
                user: smtpUser,
                passwordEncrypted: content || '',
                iv: iv || '',
                senderName,
                secure: parseInt(port) === 465
            }
        });
    }


    @Post('test')
    @Permissions('manage_own_config')
    async testConnection(@Request() req: any) {
        const userId = req.user.userId;
        return this.mailerService.verifyConnection(userId);
    }
}

