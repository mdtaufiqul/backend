import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesGateway } from './messages.gateway';
import { MessagesController } from './messages.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { forwardRef } from '@nestjs/common';

@Module({
    imports: [PrismaModule, forwardRef(() => ConversationsModule)],
    providers: [MessagesService, MessagesGateway],
    controllers: [MessagesController],
    exports: [MessagesService, MessagesGateway],
})
export class MessagesModule { }
