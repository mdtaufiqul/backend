import { Global, Module } from '@nestjs/common';
import { CacheService } from './cache.service';
import { EncryptionService } from './encryption.service';
import { LogStoreService } from './log-store.service';

@Global()
@Module({
    providers: [CacheService, EncryptionService, LogStoreService],
    exports: [CacheService, EncryptionService, LogStoreService],
})
export class CommonModule { }
