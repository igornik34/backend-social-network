import {Body, Controller, Get, Param, Put, Query, UploadedFile, UploadedFiles, UseInterceptors} from '@nestjs/common';
import { UsersService } from './users.service';
import { ApiResponse } from '@nestjs/swagger';
import { SearchUsersDto } from './dto/search-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserDto } from './dto/user.dto';
import { Authorization } from 'src/auth/decorators/authorization.decorator';
import { Authorized } from 'src/auth/decorators/authorized.decorator';
import {FileInterceptor, FilesInterceptor} from '@nestjs/platform-express';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id')
  @Authorization()
  @ApiResponse({ status: 200, type: UserDto })
  async getUser(
      @Param('id') id: string,
      @Authorized('id') userId: string
  ): Promise<UserDto | null> {
    return this.usersService.findById(id, userId);
  }

  @Put('')
  @Authorization()
  @UseInterceptors(FileInterceptor('avatar'))
  @ApiResponse({ status: 200, type: UserDto })
  async updateUser(
    @Authorized('id') id: string,
    @Body() dto: UpdateUserDto,
    @UploadedFile() avatar?: Express.Multer.File,
  ): Promise<UserDto> {
    return this.usersService.updateUser(id, dto, avatar);
  }

  @Get()
  @Authorization()
  @ApiResponse({ status: 200, type: [UserDto] })
  async searchUsers(
      @Query() dto: SearchUsersDto,
      @Authorized('id') userId: string
  ) {
    return this.usersService.searchUsers(userId, dto);
  }

}
