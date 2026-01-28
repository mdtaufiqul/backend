import { Controller, Post, Body, Get, Request, UseGuards, Param } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

import { RoleTemplateService } from './role-template.service';

@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly roleTemplateService: RoleTemplateService
    ) { }

    @Post('role-templates')
    @UseGuards(JwtAuthGuard)
    async updateRoleTemplate(@Request() req, @Body() body: { role: string; clinicId?: string; permissions: any }) {
        // If clinicId is not provided, it might mean default system template, 
        // but typically this comes from a logged-in admin for their clinic.
        return this.roleTemplateService.updateTemplate(
            body.clinicId || 'default',
            body.role,
            body.permissions,
            req.user.userId
        );
    }

    @Post('register')
    async register(@Body() body: any) {
        return this.authService.register(body);
    }

    @Post('login')
    async login(@Body() body: any) {
        return this.authService.login(body);
    }

    @Post('select-role')
    async selectRole(@Body() body: { tempToken: string; profileId: string; profileType: string }) {
        return this.authService.selectRole(body.tempToken, body.profileId, body.profileType);
    }

    // Get current authenticated user
    @Get('me')
    @UseGuards(JwtAuthGuard)
    async getMe(@Request() req) {
        return this.authService.getMe(req.user);
    }

    @Post('switch-role/:membershipId')
    @UseGuards(JwtAuthGuard)
    async switchRole(@Request() req, @Param('membershipId') membershipId: string) {
        return this.authService.switchRole(req.user.userId, membershipId);
    }

    // Backward compatibility alias for /profile
    @Get('profile')
    @UseGuards(JwtAuthGuard)
    async getProfile(@Request() req) {
        return this.authService.getMe(req.user);
    }

    @Post('forgot-password')
    async forgotPassword(@Body() body: { email: string }) {
        return this.authService.forgotPassword(body.email);
    }

    @Post('reset-password')
    async resetPassword(@Body() body: { token: string; newPassword: string }) {
        return this.authService.resetPassword(body.token, body.newPassword);
    }

    @Post('verify-password')
    @UseGuards(JwtAuthGuard)
    async verifyPassword(@Request() req, @Body() body: { password: string }) {
        const isValid = await this.authService.verifyPassword(req.user.userId, body.password);
        return { isValid };
    }

    @Post('change-password')
    @UseGuards(JwtAuthGuard)
    async changePassword(@Request() req, @Body() body: { newPassword: string }) {
        // ideally we would verify oldPassword here too in a single transaction/call but we split for UI flow
        return this.authService.changePassword(req.user.userId, body.newPassword);
    }

    @Post('request-verification')
    async requestVerification(@Body() body: { email: string; name: string; password: string; role: string; timezone?: string }) {
        return this.authService.requestVerification(body);
    }

    @Post('verify-and-create')
    async verifyAndCreate(@Body() body: { email: string; code: string }) {
        return this.authService.verifyAndCreateAccount(body.email, body.code);
    }

    @Post('verify-invite')
    async verifyInvite(@Body() body: { token: string }) {
        return this.authService.verifyInvite(body.token);
    }
}
