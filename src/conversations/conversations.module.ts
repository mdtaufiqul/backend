import { Module } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { ConversationsController } from './conversations.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { forwardRef } from '@nestjs/common';
import { MessagesModule } from '../messages/messages.module';
import { WorkflowModule } from '../workflow/workflow.module';

@Module({
    imports: [PrismaModule, forwardRef(() => MessagesModule), forwardRef(() => WorkflowModule)],
    controllers: [ConversationsController],
    providers: [ConversationsService],
    exports: [ConversationsService],
})
export class ConversationsModule { }
