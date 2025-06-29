import { Module } from '@nestjs/common';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import {UploaderModule} from "../uploader/uploader.module";

@Module({
  controllers: [PostsController],
  providers: [PostsService],
  imports: [UploaderModule]
})
export class PostsModule {}
