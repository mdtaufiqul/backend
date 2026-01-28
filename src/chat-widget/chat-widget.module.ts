import { Module } from '@nestjs/common';
import { ChatWidgetController } from './chat-widget.controller';
import { ChatWidgetService } from './chat-widget.service';
import { PrismaModule } from '../prisma/prisma.module';
import { MessagesModule } from '../messages/messages.module';

@Module({
    imports: [PrismaModule, MessagesModule],
    controllers: [ChatWidgetController],
    providers: [ChatWidgetService],
    exports: [ChatWidgetService]
})
export class ChatWidgetModule { }
