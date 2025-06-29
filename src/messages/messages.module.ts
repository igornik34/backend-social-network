import {forwardRef, Module} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import {ChatModule} from "../chat/chat.module";
import {UploaderModule} from "../uploader/uploader.module";

@Module({
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
  imports: [forwardRef(() => ChatModule), UploaderModule]
})
export class MessagesModule {}
