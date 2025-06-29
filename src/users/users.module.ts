import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import {UploaderModule} from "../uploader/uploader.module";
import {FollowersModule} from "../followers/followers.module";
import {ChatModule} from "../chat/chat.module";

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
  imports: [UploaderModule, FollowersModule, ChatModule]
})
export class UsersModule {}
