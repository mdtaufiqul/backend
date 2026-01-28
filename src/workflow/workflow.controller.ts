import { Controller, Get, Query, Res, Logger } from '@nestjs/common';
import { WorkflowOrchestrator } from './workflow.orchestrator';
import * as express from 'express';

@Controller('workflow')
export class WorkflowController {
    private readonly logger = new Logger(WorkflowController.name);

    constructor(private readonly orchestrator: WorkflowOrchestrator) { }

    /**
     * Handles link clicks from emails
     * Usage: /api/workflow/click?patientId=...&action=confirm
     */
    @Get('click')
    async handleLinkClick(
        @Query('patientId') patientId: string,
        @Query('action') action: string,
        @Res() res: express.Response
    ) {
        if (!patientId || !action) {
            return res.status(400).send("Invalid parameters");
        }

        this.logger.log(`Received Link Click: Patient ${patientId}, Action ${action}`);

        try {
            await this.orchestrator.triggerInputEvent(patientId, 'EMAIL', action);

            // Redirect to a thank you page (or generic success page)
            // Ideally this URL comes from config
            return (res as any).redirect('http://localhost:3000/thank-you?status=success');
        } catch (error) {
            this.logger.error(`Error processing link click: ${error.message}`);
            return (res as any).redirect('http://localhost:3000/thank-you?status=error');
        }
    }
}
