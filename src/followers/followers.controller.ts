import { Controller, Get, Post, Delete, Query, Body, Param } from '@nestjs/common';
import { FollowersService } from './followers.service';
import { PaginationParams, FollowersResponse } from './dto/followers.dto';
import { Authorization } from 'src/auth/decorators/authorization.decorator';
import { Authorized } from 'src/auth/decorators/authorized.decorator';

@Controller('followers')
export class FollowersController {
  constructor(private readonly followersService: FollowersService) { }

  @Get('followers/:userId')
  @Authorization()
  async getFollowers(
    @Param('userId') userId: string,
    @Query() params: PaginationParams & { query: string },
  ): Promise<FollowersResponse> {
    console.log(1)
    return this.followersService.getFollowers(userId, params);
  }

  @Get('following/:userId')
  @Authorization()
  async getFollowing(
    @Param('userId') userId: string,
    @Query() params: PaginationParams & { query: string },
  ): Promise<FollowersResponse> {
    console.log(2)
    return this.followersService.getFollowing(userId, params);
  }

  @Post(':userId')
  @Authorization()
  async followUser(
    @Authorized('id') userId: string,
    @Param('userId') followerId: string,
  ): Promise<boolean> {
    console.log(3)
    return this.followersService.followUser(userId, followerId);
  }

  @Delete(':userId')
  @Authorization()
  async unfollowUser(
    @Authorized('id') userId: string,
    @Param('userId') followerId: string,
  ): Promise<boolean> {
    console.log(4)
    return this.followersService.unfollowUser(userId, followerId);
  }

  @Get('suggested-users')
  @Authorization()
  async getSuggestedUsers(
    @Authorized('id') userId: string,
    @Query() params: PaginationParams,
  ): Promise<FollowersResponse> {
    console.log(123)
    return this.followersService.getSuggestedUsers(userId, params);
  }
}