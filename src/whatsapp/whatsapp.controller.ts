import { Controller, Post, Get, Put, Body, UseGuards, Request, Query, HttpException, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WhatsAppTierService } from '../services/whatsapp-tier.service';
import { PrismaService } from '../prisma/prisma.service';

class LinkMetaDto {
    code: string; // OAuth code from Meta
}

class VerifyQrDto {
    sessionKey: string;
}

@Controller('whatsapp')
@UseGuards(JwtAuthGuard)
export class WhatsAppController {
    constructor(
        private whatsappTierService: WhatsAppTierService,
        private prisma: PrismaService,
    ) { }

    /**
     * Link Meta Business Account (Tier 1)
     * Called after user completes Facebook OAuth flow
     */
    @Post('meta/link')
    async linkMetaBusiness(@Request() req, @Body() dto: LinkMetaDto) {
        const userId = req.user.userId;
        await this.whatsappTierService.linkMetaBusiness(userId, dto.code);
        return { success: true, message: 'Meta Business Account linked successfully' };
    }

    /**
     * Generate QR Code for WhatsApp setup (Tier 2)
     * Returns base64 QR code image
     */
    @Get('qr')
    async generateQrCode(@Request() req) {
        const userId = req.user.userId;
        const qrCodeBase64 = await this.whatsappTierService.generateQrCode(userId);
        return {
            success: true,
            qrCode: qrCodeBase64,
            message: 'Scan this QR code with WhatsApp to link your account',
        };
    }

    /**
     * Verify QR Code session after scanning
     * Polls this endpoint to check if QR was scanned
     */
    @Post('qr/verify')
    async verifyQrSession(@Request() req) {
        const userId = req.user.userId;
        const isVerified = await this.whatsappTierService.verifyQrSession(userId);

        if (isVerified) {
            return {
                success: true,
                message: 'WhatsApp connected successfully via QR code',
            };
        } else {
            return {
                success: false,
                message: 'QR code not scanned yet or session expired',
            };
        }
    }

    /**
     * Get current WhatsApp configuration status
     */
    @Get('status')
    async getStatus(@Request() req) {
        const userId = req.user.userId;

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                whatsappTier: true,
                metaBusinessId: true,
                whatsappQrSession: true,
                whatsappQrExpiry: true,
                whatsappPhoneNumber: true,
            },
        });

        let isSystemQrActive = false;
        try {
            isSystemQrActive = await this.whatsappTierService.verifySystemQrSession();
        } catch (error) {
            // Log error but don't block status response (Evolution API might be down)
            console.warn(`Failed to verify system QR status: ${error.message}`);
        }

        return {
            tier: user?.whatsappTier || 'SYSTEM_FALLBACK',
            isMetaLinked: !!user?.metaBusinessId,
            isQrActive: user?.whatsappQrExpiry ? user.whatsappQrExpiry > new Date() : false,
            phoneNumber: user?.whatsappPhoneNumber,
            isSystemQrActive,
            isTwilioConfigured: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER)
        };
    }

    /**
     * Send a test message using current configuration
     */
    @Post('test')
    async sendTestMessage(@Request() req, @Body() body: { to: string }) {
        const userId = req.user.userId;
        const { to } = body;

        if (!to) {
            throw new HttpException('Phone number is required', HttpStatus.BAD_REQUEST);
        }

        try {
            await this.whatsappTierService.sendWhatsApp(userId, to, "This is a test message from MediFlow.");
            return { success: true, message: 'Test message sent successfully' };
        } catch (error) {
            throw new HttpException(error.message || 'Failed to send test message', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Update active WhatsApp Tier
     */
    @Put('tier')
    async updateTier(@Request() req, @Body() body: { tier: any }) {
        const userId = req.user.userId;
        await this.whatsappTierService.updateTier(userId, body.tier);
        return { success: true, message: 'WhatsApp tier updated successfully' };
    }

    @Get('meta/url')
    getMetaAuthUrl() {
        return { url: this.whatsappTierService.getMetaAuthUrl() };
    }

    @Post('meta/disconnect')
    async disconnectMeta(@Request() req) {
        const userId = req.user.userId;
        await this.whatsappTierService.disconnectMeta(userId);
        return { success: true, message: 'Disconnected Meta Account' };
    }

    @Get('system/qr')
    async generateSystemQrCode(@Request() req) {
        // Optional: specific admin check here
        const qrCodeBase64 = await this.whatsappTierService.generateSystemQrCode();
        return {
            success: true,
            qrCode: qrCodeBase64,
            message: 'Scan this QR code to set up the System WhatsApp Number',
        };
    }

    @Post('system/qr/verify')
    async verifySystemQrSession(@Request() req) {
        const isVerified = await this.whatsappTierService.verifySystemQrSession();
        return {
            success: isVerified,
            message: isVerified ? 'System WhatsApp connected' : 'Not connected yet',
        };
    }

    @Post('qr/disconnect')
    async disconnectQr(@Request() req) {
        const userId = req.user.userId;
        await this.whatsappTierService.disconnectQr(userId);
        return { success: true, message: 'Disconnected QR Session' };
    }
}
