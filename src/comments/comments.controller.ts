import {
  Controller,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards, Get, Query,
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { ApiBearerAuth, ApiTags, ApiResponse } from '@nestjs/swagger';
import { Authorization } from 'src/auth/decorators/authorization.decorator';
import { Authorized } from 'src/auth/decorators/authorized.decorator';
import { CreateCommentDto, UpdateCommentDto } from './dto/comments.dto';

@ApiTags('comments')
@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get(':id')
  @Authorization()
  async getPostComments(
      @Param('id') postId: string,
      @Query('limit') limit: number = 10,
      @Query('offset') offset: number = 0,
  ) {
    return this.commentsService.getPostComments(postId, limit, offset);
  }

  @Get(':id/:parentId')
  @Authorization()
  async getRepliesPostComments(
      @Param('id') postId: string,
      @Param('parentId') parentId: string,
      @Query('limit') limit: number = 10,
      @Query('offset') offset: number = 0,
  ) {
    return this.commentsService.getPostComments(postId, limit, offset, parentId);
  }

  @Post()
  @Authorization()
  async createComment(
    @Authorized('id') userId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.createComment(userId, dto);
  }

  @Put(':id')
  @Authorization()
  async updateComment(
    @Authorized('id') userId: string,
    @Param('id') commentId: string,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.commentsService.updateComment(userId, commentId, dto);
  }

  @Delete(':id')
  @Authorization()
  async deleteComment(
    @Authorized('id') userId: string,
    @Param('id') commentId: string,
  ): Promise<string> {
    return this.commentsService.deleteComment(userId, commentId);
  }

  @Post(':id/reply')
  @Authorization()
  async replyToComment(
    @Authorized('id') userId: string,
    @Param('id') commentId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.replyToComment(userId, commentId, dto);
  }
}