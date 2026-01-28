import { Controller, Get, Post, Body, Param, Delete, Req, UseGuards } from '@nestjs/common';
import { MeetingsService } from './meetings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('meetings')
@UseGuards(JwtAuthGuard)
export class MeetingsController {
    constructor(private readonly meetingsService: MeetingsService) { }

    @Post()
    create(@Body() createMeetingDto: any, @Req() req: any) {
        return this.meetingsService.create(
            createMeetingDto,
            req.user.id,
            req.user.role,
            req.user.clinicId
        );
    }

    @Get()
    findAll(@Req() req: any) {
        return this.meetingsService.findAll(
            req.user.clinicId,
            req.user.id,
            req.user.role
        );
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.meetingsService.findOne(id);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @Req() req: any) {
        return this.meetingsService.remove(id, req.user.id);
    }
}
