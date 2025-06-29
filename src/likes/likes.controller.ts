import { Controller, Delete, Param, Post } from '@nestjs/common';
import { LikesService } from './likes.service';
import { Authorized } from 'src/auth/decorators/authorized.decorator';
import { Authorization } from 'src/auth/decorators/authorization.decorator';

@Controller('likes')
export class LikesController {
  constructor(private readonly likesService: LikesService) {}

  @Post(':postId')
  @Authorization()
  async likePost(
    @Authorized('id') userId: string,
    @Param('postId') postId: string
  ): Promise<string> {
    return this.likesService.likePost(postId, userId);
  }

  @Delete(':postId')
  @Authorization()
  async unlikePost(
    @Authorized('id') userId: string,
    @Param('postId') postId: string
  ): Promise<string> {
    console.log(userId)
    return this.likesService.unlikePost(postId, userId);
  }
}
