
import { Injectable, LoggerService, ConsoleLogger } from '@nestjs/common';

export interface LogEntry {
    timestamp: string;
    level: string;
    message: string;
    context?: string;
}

@Injectable()
export class LogStoreService extends ConsoleLogger {
    private static logs: LogEntry[] = [];
    private static MAX_LOGS = 100;

    log(message: any, context?: string) {
        super.log(message, context);
        this.addLog('log', message, context);
    }

    error(message: any, stack?: string, context?: string) {
        super.error(message, stack, context);
        this.addLog('error', message, context);
    }

    warn(message: any, context?: string) {
        super.warn(message, context);
        this.addLog('warn', message, context);
    }

    debug(message: any, context?: string) {
        super.debug(message, context);
        this.addLog('debug', message, context);
    }

    private addLog(level: string, message: any, context?: string) {
        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level,
            message: typeof message === 'string' ? message : JSON.stringify(message),
            context,
        };
        LogStoreService.logs.unshift(entry);
        if (LogStoreService.logs.length > LogStoreService.MAX_LOGS) {
            LogStoreService.logs.pop();
        }
    }

    static getLogs() {
        return this.logs;
    }
}
