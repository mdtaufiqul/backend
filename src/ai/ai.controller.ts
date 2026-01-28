import { Controller, Post, Body, UseInterceptors, UploadedFile, BadRequestException, UseGuards } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AiService } from '../services/ai.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@Controller('ai')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AiController {
    constructor(private readonly aiService: AiService) { }

    @Post('patient-summary')
    @Permissions('view_patients')
    async generatePatientSummary(@Body() data: {
        demographics?: any;
        appointments?: any[];
        notes?: any[];
        forms?: any[];
    }) {
        if (!data) throw new BadRequestException('Patient data is required');
        const summary = await this.aiService.generatePatientSummary(data);
        return { summary };
    }

    @Post('generate-notes')
    @Permissions('manage_patients') // Assuming doctors managing patients need this
    async generateNotes(@Body() body: { context: string; prompt: string }) {
        if (!body.context || !body.prompt) throw new BadRequestException('Context and prompt are required');
        const notes = await this.aiService.generateNotes(body.context, body.prompt);
        return { notes };
    }

    @Post('transcribe')
    @UseInterceptors(FileInterceptor('file')) // Memory storage by default is fine for transient processing
    async transcribeAudio(@UploadedFile() file: Express.Multer.File) {
        if (!file) throw new BadRequestException('Audio file is required');

        // Basic validation for audio types could be added here

        const text = await this.aiService.transcribeAudio(file);
        return { text };
    }

    @Post('summarize-meeting')
    async summarizeMeeting(@Body() body: { transcript: string }) {
        if (!body.transcript) throw new BadRequestException('Transcript is required');
        const summary = await this.aiService.summarizeMeeting(body.transcript);
        return { summary };
    }

    @Post('summarize-conversation')
    async summarizeConversation(@Body() body: { conversation: any[] }) {
        if (!body.conversation || !Array.isArray(body.conversation)) {
            throw new BadRequestException('Conversation array is required');
        }
        const summary = await this.aiService.summarizeConversation(body.conversation);
        return { summary };
    }

    @Post('segment-conversation')
    async segmentConversation(@Body() body: { transcript: string }) {
        if (!body.transcript) throw new BadRequestException('Transcript is required');
        const segmented = await this.aiService.segmentConversation(body.transcript);
        return { segmented };
    }

    @Post('summarize-soap')
    async summarizeSoap(@Body() body: { conversation: any[] }) {
        if (!body.conversation || !Array.isArray(body.conversation)) {
            throw new BadRequestException('Conversation array is required');
        }
        const soap = await this.aiService.generateSoapNote(body.conversation);
        return { soap };
    }

    @Post('extract-vitals')
    async extractVitals(@Body() body: { transcript: string }) {
        if (!body.transcript) throw new BadRequestException('Transcript is required');
        const vitals = await this.aiService.extractVitals(body.transcript);
        return { vitals };
    }

    @Post('structure-dictation')
    async structureDictation(@Body() body: { dictation: string }) {
        if (!body.dictation) throw new BadRequestException('Dictation text is required');
        const soap = await this.aiService.structureClinicalDictation(body.dictation);
        return { soap };
    }
}
