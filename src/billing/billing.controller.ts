import { Controller, Get, Post, Body, UseGuards, Request, Param } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { BillingService } from './billing.service';

@Controller('billing')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class BillingController {
    constructor(private readonly billingService: BillingService) { }

    @Get('invoices')
    @Permissions('view_billing')
    async getInvoices(@Request() req) {
        const clinicId = req.user.clinicId || 'default';
        return this.billingService.getInvoices(clinicId);
    }

    @Get('stats')
    @Permissions('view_billing')
    async getStats(@Request() req) {
        const clinicId = req.user.clinicId || 'default';
        return this.billingService.getStats(clinicId);
    }

    @Post('invoices')
    @Permissions('manage_billing')
    async createInvoice(@Request() req, @Body() data: any) {
        const clinicId = req.user.clinicId || 'default';
        return this.billingService.createInvoice(clinicId, data);
    }
}
