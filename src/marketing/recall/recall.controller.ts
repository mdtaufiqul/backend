
import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { RecallService } from './recall.service';

@Controller('marketing/recall')
export class RecallController {
    constructor(private readonly recallService: RecallService) { }

    @Post('scan')
    async scan() {
        return this.recallService.scanForOpportunities();
    }

    @Get('opportunities')
    async list() {
        return this.recallService.getOpportunities();
    }

    @Post(':id/send')
    async send(@Param('id') id: string) {
        return this.recallService.sendRecall(id);
    }

    @Post(':id/dismiss')
    async dismiss(@Param('id') id: string) {
        return this.recallService.dismissRecall(id);
    }
}
