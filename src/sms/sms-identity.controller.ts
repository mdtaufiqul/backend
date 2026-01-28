import { Controller, Post, Get, Put, Body, UseGuards, Request, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SmsSenderService } from '../services/sms-sender.service';
import { PrismaService } from '../prisma/prisma.service';
import { SmsTier } from '@prisma/client';

class VerifyNumberDto {
    phoneNumber: string;
    verificationCode: string;
}

class UpdateSmsIdentityDto {
    tier: SmsTier;
    personalSmsNumber?: string;
    customSenderName?: string;
}

@Controller('sms')
@UseGuards(JwtAuthGuard)
export class SmsIdentityController {
    constructor(
        private smsSenderService: SmsSenderService,
        private prisma: PrismaService,
    ) { }

    /**
     * Verify doctor's personal phone number
     * Sends verification code via Twilio
     */
    @Post('verify-number')
    async verifyPhoneNumber(@Request() req, @Body() dto: VerifyNumberDto) {
        const userId = req.user.userId;

        // In production, verify the code sent via SMS
        // For now, simple validation
        if (!dto.phoneNumber || !dto.verificationCode) {
            return { success: false, message: 'Phone number and verification code required' };
        }

        // Mark number as verified
        await this.prisma.user.update({
            where: { id: userId },
            data: {
                personalSmsNumber: dto.phoneNumber,
                smsNumberVerified: true,
                smsTier: SmsTier.PERSONAL_NUMBER,
            },
        });

        return {
            success: true,
            message: 'Phone number verified successfully',
        };
    }

    /**
     * Update SMS identity configuration
     */
    @Put('identity')
    async updateSmsIdentity(@Request() req, @Body() dto: UpdateSmsIdentityDto) {
        const userId = req.user.userId;

        // Validate alphanumeric sender ID if using custom branding
        if (dto.tier === SmsTier.CUSTOM_BRANDING && dto.customSenderName) {
            const isValid = this.smsSenderService.validateAlphanumericId(dto.customSenderName);
            if (!isValid) {
                return {
                    success: false,
                    message: 'Invalid sender ID. Must be max 11 characters, alphanumeric only, with at least one letter.',
                };
            }
        }

        // Update user's SMS configuration
        const updateData: any = { smsTier: dto.tier };

        if (dto.personalSmsNumber) {
            updateData.personalSmsNumber = dto.personalSmsNumber;
        }

        if (dto.customSenderName) {
            updateData.customSenderName = dto.customSenderName.toUpperCase(); // Normalize to uppercase
        }

        await this.prisma.user.update({
            where: { id: userId },
            data: updateData,
        });

        return {
            success: true,
            message: 'SMS identity updated successfully',
        };
    }

    /**
     * Get SMS preview showing how message will appear
     */
    @Get('preview')
    async previewSms(@Request() req, @Query('tier') tier?: string) {
        const userId = req.user.userId;
        const selectedTier = (tier as SmsTier) || undefined;

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                smsTier: true,
                personalSmsNumber: true,
                customSenderName: true,
                name: true,
            },
        });

        if (!user) {
            return { success: false, message: 'User not found' };
        }

        // Get identity based on tier
        const identity = await this.smsSenderService.getSmsIdentity(userId);

        return {
            success: true,
            preview: {
                from: identity.from,
                displayName: identity.displayName,
                tier: identity.tier,
                isAlphanumeric: identity.isAlphanumeric,
                note: identity.isAlphanumeric
                    ? 'Alphanumeric sender IDs are one-way only. Patients cannot reply.'
                    : 'Patients can reply to this number.',
            },
        };
    }

    /**
     * Get list of countries that support alphanumeric sender IDs
     */
    @Get('supported-countries')
    getSupportedCountries() {
        const countries = this.smsSenderService.getSupportedCountries();
        return {
            success: true,
            countries,
            message: 'These countries support alphanumeric sender IDs',
        };
    }

    /**
     * Get current SMS identity configuration
     */
    @Get('identity')
    async getSmsIdentity(@Request() req) {
        const userId = req.user.userId;

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                smsTier: true,
                personalSmsNumber: true,
                smsNumberVerified: true,
                customSenderName: true,
            },
        });

        return {
            success: true,
            config: {
                tier: user?.smsTier || SmsTier.SYSTEM_DEFAULT,
                personalNumber: user?.personalSmsNumber,
                numberVerified: user?.smsNumberVerified || false,
                customSenderName: user?.customSenderName,
            },
        };
    }
}
