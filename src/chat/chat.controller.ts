import {Controller, Get, Param, Query} from '@nestjs/common';
import { ChatService } from './chat.service';
import {Authorization} from "../auth/decorators/authorization.decorator";
import {Authorized} from "../auth/decorators/authorized.decorator";

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get()
  @Authorization()
  async getChats(
      @Authorized('id') userId: string,
      @Query('limit') limit: number = 20,
      @Query('offset') offset: number = 0,
      @Query('query') query: string,
  ) {
    return this.chatService.getUserChats(userId, limit, offset, query);
  }

  @Get(':chatId')
  @Authorization()
  async getChatById(
      @Param('chatId') chatId: string,
      @Authorized('id') userId: string,
  ) {
    return this.chatService.getChatById(chatId, userId);
  }

  @Get('/count/unread')
  @Authorization()
  async getCountUnreadChats(
      @Authorized('id') userId: string,
  ) {
    return this.chatService.getCountUnreadChats(userId);
  }
}
