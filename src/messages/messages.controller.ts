import {Body, Controller, Delete, Get, Param, Post, Put, Query, UploadedFiles, UseInterceptors} from '@nestjs/common';
import { MessagesService } from './messages.service';
import {Authorization} from "../auth/decorators/authorization.decorator";
import {Authorized} from "../auth/decorators/authorized.decorator";
import {FilesInterceptor} from "@nestjs/platform-express";
import {CreateMessageDto} from "./dto/create-message.dto";
import {UpdateMessageDto} from "./dto/update-message.dto";

@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get(':chatId')
  @Authorization()
  async getMessages(
      @Authorized('id') userId: string,
      @Param('chatId') chatId: string,
      @Query('limit') limit: number = 20,
      @Query('offset') offset: number = 0,
  ) {
    return this.messagesService.getMessages(chatId, userId, limit, offset);
  }


  @Post()
  @Authorization()
  @UseInterceptors(FilesInterceptor('attachments'))
  async createMessage(
      @Authorized('id') userId: string,
      @Body() dto: CreateMessageDto,
      @UploadedFiles() attachments?: Express.Multer.File[]
  ) {
    return this.messagesService.createMessage(userId, dto.recipientId, dto.content, attachments)
  }

  @Post('/mark-as-read/:chatId')
  @Authorization()
  async markAsRead(
      @Param('chatId') chatId: string,
      @Authorized('id') userId: string,
      @Body() messageIds: string[],
  ) {
    return this.messagesService.markMessagesAsRead(chatId, userId, messageIds)
  }

  @Put(':messageId')
  @Authorization()
  @UseInterceptors(FilesInterceptor('attachments'))
  async updateMessage(
      @Authorized('id') userId: string,
      @Param('messageId') messageId: string,
      @Body() dto: UpdateMessageDto,
      @UploadedFiles() attachments?: Express.Multer.File[],
  ) {
    return this.messagesService.updateMessage(messageId, userId, dto.content)
  }

  @Delete(':messageId')
  @Authorization()
  async deleteMessage(
      @Authorized('id') userId: string,
      @Param('messageId') messageId: string,
  ) {
    return this.messagesService.deleteMessage(messageId, userId)
  }
}
