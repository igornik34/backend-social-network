import { Body, Controller, Delete, Get, Param, Post, Put, Query, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { PostsService } from './posts.service';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Authorization } from 'src/auth/decorators/authorization.decorator';
import { Authorized } from 'src/auth/decorators/authorized.decorator';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) { }

  @Post()
  @Authorization()
  @UseInterceptors(FilesInterceptor('images'))
  async createPost(
    @Authorized('id') id: string,
    @Body() dto: CreatePostDto,
    @UploadedFiles() images?: Express.Multer.File[]
  ) {
    console.log(dto)
    return this.postsService.createPost(id, dto, images)
  }

  @Put(':id')
  @Authorization()
  @UseInterceptors(FilesInterceptor('images'))
  async updatePost(
    @Authorized('id') userId: string,
    @Body() dto: UpdatePostDto,
    @Param('id') postId: string,
    @UploadedFiles() images?: Express.Multer.File[],
  ) {
    return this.postsService.updatePost(postId, userId, dto, images)
  }

  @Delete(':id')
  @Authorization()
  async deletePost(
    @Authorized('id') userId: string,
    @Param('id') postId: string,
  ) {
    return this.postsService.deletePost(postId, userId)
  }

  @Get('/feed')
  @Authorization()
  async getFeedPosts(
    @Authorized('id') userId: string,
    @Query('limit') limit: number = 10,
    @Query('offset') offset: number = 0,
  ) {
    return this.postsService.getFeedPosts(userId, limit, offset);
  }

  @Get('/by-user/:userId')
  @Authorization()
  async getPosts(
    @Param('userId') userId: string,
    @Query('limit') limit: number = 10,
    @Query('offset') offset: number = 0,
  ) {
    return this.postsService.getPosts(limit, offset, userId);
  }

  @Get(':id')
  @Authorization()
  async getPostById(
    @Authorized('id') userId: string,
    @Param('id') postId: string,
  ) {
    return this.postsService.findById(postId, userId);
  }

  @Get(':id/likes')
  @Authorization()
  async getPostLikes(
    @Param('id') postId: string,
    @Query('limit') limit: number = 10,
    @Query('offset') offset: number = 0,
  ) {
    return this.postsService.getPostLikes(postId, limit, offset);
  }
}
