import { Controller, Get, UseGuards } from '@nestjs/common';
import { LogStoreService } from '../common/log-store.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('logs')
@UseGuards(JwtAuthGuard)
export class LogsController {
    @Get()
    getLogs() {
        return LogStoreService.getLogs();
    }
}
