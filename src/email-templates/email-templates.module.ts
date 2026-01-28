import { Module } from '@nestjs/common';
import { EmailTemplatesService } from './email-templates.service';
import { EmailTemplatesController } from './email-templates.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [EmailTemplatesController],
    providers: [EmailTemplatesService],
    exports: [EmailTemplatesService]
})
export class EmailTemplatesModule { }
