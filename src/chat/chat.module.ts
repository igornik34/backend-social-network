import {forwardRef, Module} from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import {MessagesModule} from "../messages/messages.module";

@Module({
  controllers: [ChatController],
  providers: [ChatService],
  imports: [forwardRef(() => MessagesModule)],
  exports: [ChatService]
})
export class ChatModule {}
