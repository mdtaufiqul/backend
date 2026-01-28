import { Controller, Get, UseGuards, Request, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
    constructor(private readonly dashboardService: DashboardService) { }

    @Get('summary')
    async getSummary(@Request() req) {
        return this.dashboardService.getSummary(req.user);
    }

    @Get('analytics')
    async getAnalytics(@Request() req, @Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
        return this.dashboardService.getClinicalAnalytics(req.user, { startDate, endDate });
    }

    @Get('analytics/export')
    async exportAnalytics(@Res() res: Response, @Request() req, @Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
        const csv = await this.dashboardService.exportClinicalAnalytics(req.user, { startDate, endDate });
        res.set({
            'Content-Type': 'text/csv',
            'Content-Disposition': 'attachment; filename="clinical_analytics_report.csv"',
        });
        return res.send(csv);
    }
}
