import { Controller, Get, Param, Query, Res, Redirect } from '@nestjs/common';
import type { Response } from 'express';
import { WorkflowOrchestrator } from '../workflow/workflow.orchestrator';

@Controller('workflow/tracking')
export class EmailTrackingController {
    constructor(
        private readonly orchestrator: WorkflowOrchestrator
    ) { }

    @Get('open/:instanceId/:stepId')
    async trackOpen(
        @Param('instanceId') instanceId: string,
        @Param('stepId') stepId: string,
        @Query('templateId') templateId: string,
        @Res() res: Response
    ) {
        // Trigger generic event
        // We pass instanceId/stepId for context if we want to resume a waiting node
        // We pass templateId to match "Trigger: Email Opened (Template X)"

        // Non-blocking trigger
        this.orchestrator.handleTrackingEvent('EMAIL_OPENED', {
            instanceId,
            stepId,
            templateId
        }).catch(err => console.error('Tracking Error', err));

        // Return 1x1 generic transparent pixel
        const pixel = Buffer.from(
            'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
            'base64'
        );
        res.writeHead(200, {
            'Content-Type': 'image/gif',
            'Content-Length': pixel.length,
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
        });
        res.end(pixel);
    }

    @Get('click/:instanceId/:stepId')
    async trackClick(
        @Param('instanceId') instanceId: string,
        @Param('stepId') stepId: string,
        @Query('action') action: string, // e.g. 'confirm', 'cancel'
        @Query('url') url: string,
        @Res() res: Response
    ) {
        if (!url) {
            return res.status(400).send('Missing destination URL');
        }

        this.orchestrator.handleTrackingEvent('LINK_CLICKED', {
            instanceId,
            stepId,
            action: action || 'DEFAULT'
        }).catch(err => console.error('Tracking Click Error', err));

        // Redirect
        res.redirect(decodeURIComponent(url));
    }
}
